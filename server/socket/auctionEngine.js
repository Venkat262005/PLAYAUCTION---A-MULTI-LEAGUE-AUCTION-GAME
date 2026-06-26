const Room = require('../models/Room');
const Player = require('../models/Player');
const { generateQuiz } = require('../services/quizEngine');
const { buildQuizLeaderboard, getSafeQuizQuestion } = require('../utils/quizHelpers');
const AuctionRoom = require('../models/AuctionRoom');
const ActiveRoom = require('../models/ActiveRoom');
const CompletedRoom = require('../models/CompletedRoom');
const Franchise = require('../models/Franchise');
const AuctionTransaction = require('../models/AuctionTransaction');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { markDirty, flushRoom } = require('../services/dbWriter');
const { getSA20PrevSquads, validateRetentions, calculateRetentionCosts, isUncappedPlayer, TEAM_NAME_MAP } = require('../services/sa20History');
const { getWPLPrevSquads, validateWPLRetentions, calculateWPLRetentionCosts, isWPLUncappedPlayer, WPL_TEAM_NAME_MAP } = require('../services/wplHistory');

const JWT_SECRET = process.env.JWT_SECRET || 'ipl_auction_fallback_secret';

const SA20_OFFICIAL_BUDGETS = {
    'DSG': { preSignedCost: 143.0,  remainingPurse: 197.0 },
    'JSK': { preSignedCost: 244.0,  remainingPurse: 96.0  },
    'MICT': { preSignedCost: 289.5, remainingPurse: 50.5  },
    'PR':  { preSignedCost: 251.35, remainingPurse: 88.65 },
    'PC':  { preSignedCost: 242.0,  remainingPurse: 98.0  },
    'SEC': { preSignedCost: 144.0,  remainingPurse: 196.0 }
};

const { normalizePlayer, getCollectionsForLeague, mapTeamTakenToFranchise } = require('../utils/playerNormalizer');
const { getMinIncrement, getRequiredBid, snapBidForLeague } = require('../utils/bidRules');
const { isLegendPlayer } = require('../utils/legendRules');
const { isSa20UncappedAcquired } = require('../utils/sa20PlayerRules');

const isU23Player = (player) => {
    if (!player) return false;
    // 1. Explicit age check
    const age = Number(player.age || player.Age);
    if (!isNaN(age) && age > 0) {
        return age <= 23;
    }
    // 2. Explicit U23 flag
    if (player.isU23 === true || String(player.isU23).toLowerCase() === 'true') {
        return true;
    }
    // 3. Pool check (Emerging or Rookie pools are usually U-23)
    const pool = String(player.poolID || player.poolName || '').toLowerCase();
    if (pool.includes('emerging') || pool.includes('rookie')) {
        return true;
    }
    return false;
};

async function fetchAllPlayers(league = 'ipl') {
    // Exclude presigned_players from live auctioning pool
    const collections = getCollectionsForLeague(league).filter(c => c !== 'presigned_players');

    try {
        console.time("[DATA] Multi-fetch duration");
        const dbName = league === 'sa20' ? 'SA20' : league;
        const db = mongoose.connection.client.db(dbName);

        const poolResults = await Promise.all(
            collections.map(async (collName) => {
                // If collectionsList check shows this pool does not exist in this database, skip it
                let players = [];
                try {
                    players = await db.collection(collName).find({}).toArray();
                } catch (e) {
                    return [];
                }

                // Shuffle players (Fisher-Yates)
                for (let i = players.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [players[i], players[j]] = [players[j], players[i]];
                }

                return players.map(p => normalizePlayer(p, collName));
            })
        );

        const allPlayers = poolResults.flat();
        
        // --- LEGEND PUSH: Ensure first 5 players are NOT legends ---
        // The user explicitly requested that legends never appear at the start of the auction.
        for (let i = 0; i < Math.min(5, allPlayers.length); i++) {
            const pName = allPlayers[i].player || allPlayers[i].name || "";
            if (isLegendPlayer(pName, league)) {
                for (let j = 5; j < allPlayers.length; j++) {
                    const swapName = allPlayers[j].player || allPlayers[j].name || "";
                    if (!isLegendPlayer(swapName, league)) {
                        [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
                        break;
                    }
                }
            }
        }
        
        console.timeEnd("[DATA] Multi-fetch duration");
        return allPlayers;
    } catch (err) {
        console.error("[DATA] Multi-collection fetch error:", err.message);
        return [];
    }
}

/**
 * findPlayerById — searches all pool collections for a player by _id.
 */
async function findPlayerById(playerId, league = 'ipl') {
    if (!playerId) return null;
    const { ObjectId } = require('mongoose').Types;
    let oid;
    try { oid = new ObjectId(String(playerId)); } catch { return null; }

    const collections = getCollectionsForLeague(league);
    for (const collName of collections) {
        const dbName = league === 'sa20' ? 'SA20' : league;
        const db = mongoose.connection.client.db(dbName);
        const doc = await db.collection(collName).findOne({ _id: oid });
        if (doc) return doc;
    }
    return null;
}



const IPL_TEAMS = [
    { id: 'MI', name: 'Mumbai Indians', color: '#004BA0', logoUrl: '/ipl_logos/MI.png' },
    { id: 'CSK', name: 'Chennai Super Kings', color: '#FFFF3C', logoUrl: '/ipl_logos/CSK.png' },
    { id: 'RCB', name: 'Royal Challengers Bengaluru', color: '#EC1C24', logoUrl: '/ipl_logos/RCB.png' },
    { id: 'KKR', name: 'Kolkata Knight Riders', color: '#2E0854', logoUrl: '/ipl_logos/KKR.png' },
    { id: 'DC', name: 'Delhi Capitals', color: '#00008B', logoUrl: '/ipl_logos/DC.png' },
    { id: 'PBKS', name: 'Punjab Kings', color: '#ED1B24', logoUrl: '/ipl_logos/PBKS.png' },
    { id: 'RR', name: 'Rajasthan Royals', color: '#EA1A85', logoUrl: '/ipl_logos/RR.png' },
    { id: 'SRH', name: 'Sunrisers Hyderabad', color: '#FF822A', logoUrl: '/ipl_logos/SRH.png' },
    { id: 'LSG', name: 'Lucknow Super Giants', color: '#00D1FF', logoUrl: '/ipl_logos/LSG.png' },
    { id: 'GT', name: 'Gujarat Titans', color: '#1B2133', logoUrl: '/ipl_logos/GT.png' },
    { id: 'DCG', name: 'Deccan Chargers', color: '#D1E1EF', logoUrl: '/ipl_logos/DCG.png' },
    { id: 'KTK', name: 'Kochi Tuskers Kerala', color: '#F15A24', logoUrl: '/ipl_logos/KTK.png' },
    { id: 'PWI', name: 'Pune Warriors India', color: '#40E0D0', logoUrl: '/ipl_logos/PWI.png' },
    { id: 'RPS', name: 'Rising Pune Supergiant', color: '#D11D70', logoUrl: '/ipl_logos/RPS.png' },
    { id: 'GL', name: 'Gujarat Lions', color: '#E04F16', logoUrl: '/ipl_logos/GL.png' },
]; // 15 teams

const WPL_TEAMS = [
    { id: 'MI', name: 'Mumbai Indians', color: '#004BA0', logoUrl: '/wpl_logos/MI.png' },
    { id: 'DC', name: 'Delhi Capitals', color: '#00008B', logoUrl: '/wpl_logos/DC.png' },
    { id: 'RCB', name: 'Royal Challengers Bangalore', color: '#EC1C24', logoUrl: '/wpl_logos/RCB.png' },
    { id: 'GG', name: 'Gujarat Giants', color: '#E9571E', logoUrl: '/wpl_logos/Gujarat_Giants_WPL_logo.svg.png' },
    { id: 'UPW', name: 'UP Warriorz', color: '#FFFF00', logoUrl: '/wpl_logos/UP_Warriors(z)_WPL_logo.png' }
];

const SA20_TEAMS = [
    { id: 'DSG', name: "Durban's Super Giants", color: '#0A2240', logoUrl: '/sa20_logos/Durban\'s_Super_Giants_Logo.png' },
    { id: 'JSK', name: 'Joburg Super Kings', color: '#FFCC00', logoUrl: '/sa20_logos/Joburg_Super_Kings_Logo.png' },
    { id: 'MICT', name: 'MI Cape Town', color: '#004BA0', logoUrl: '/sa20_logos/MI_Cape_Town_–_Logo.png' },
    { id: 'PR', name: 'Paarl Royals', color: '#DA1884', logoUrl: '/sa20_logos/Paarl_Royals_log0.png' },
    { id: 'PC', name: 'Pretoria Capitals', color: '#00A3E0', logoUrl: '/sa20_logos/Pretoria_Capitals_logo.png' },
    { id: 'SEC', name: 'Sunrisers Eastern Cape', color: '#F26522', logoUrl: '/sa20_logos/Sunrisers_Eastern_Cape_Logo.png' }
];

const getDb = (dbName) => {
    const targetDb = dbName === 'sa20' ? 'SA20' : (dbName || 'ipl');
    const mongoose = require('mongoose');
    const baseConn = mongoose.connection;
    const conn = baseConn.useDb(targetDb, { useCache: true });
    if (!conn.db && baseConn.client) {
        conn.db = baseConn.client.db(targetDb);
    }
    return conn;
};

// In-memory state for timers to avoid DB writes for every second
const roomTimers = {};
const hostPromotionTimers = {}; // Separate map for host promotion timeouts (prevents circular ref in state)

const AI_BOTS = [
    { name: 'Rupa', userId: 'bot_rupa' },
    { name: 'Sonu', userId: 'bot_sonu' },
    { name: 'Cherry', userId: 'bot_cherry' },
    { name: 'Rocky', userId: 'bot_rocky' },
    { name: 'Tiger', userId: 'bot_tiger' },
    { name: 'Simbu', userId: 'bot_simbu' },
    { name: 'Bunny', userId: 'bot_bunny' },
    { name: 'Chintu', userId: 'bot_chintu' },
    { name: 'Pinky', userId: 'bot_pinky' },
    { name: 'Golu', userId: 'bot_golu' },
    { name: 'Monu', userId: 'bot_monu' },
    { name: 'Kittu', userId: 'bot_kittu' },
    { name: 'Bittu', userId: 'bot_bittu' },
    { name: 'Jojo', userId: 'bot_jojo' }
];

const roomStates = {}; // Keep active room state in memory for fast access, flush to DB periodically / at end

function normalizeLeague(league) {
    return ['ipl', 'wpl', 'sa20'].includes(String(league || '').toLowerCase())
        ? String(league).toLowerCase()
        : 'ipl';
}

function getPublicRoomsList(leagueFilter = null) {
    const normalizedFilter = leagueFilter ? normalizeLeague(leagueFilter) : null;

    return Object.values(roomStates)
        .filter(state => state.roomType === 'public' && state.status === 'Lobby')
        .filter(state => !normalizedFilter || normalizeLeague(state.league) === normalizedFilter)
        .map(state => ({
            roomCode: state.roomCode,
            hostName: state.hostName,
            league: normalizeLeague(state.league),
            teamsCount: state.teams.length,
            maxTeams: state.availableTeams.length + state.teams.length // practically 15
        }));
}

// Helper to strip heavy data from teams for broad broadcasts
function lightweightTeams(teams = [], league = 'ipl') {
    return teams.map(t => {
        const counts = (t.playersAcquired || []).reduce((acc, p) => {
            const role = (p.role || "").toLowerCase();
            if (role.includes("wk") || role.includes("wicket") || role.includes("keeper")) acc.wk++;
            else if (role.includes("all") || role.includes("ar")) acc.ar++;
            else if (role.includes("bowl") || role.includes("bw")) acc.bowl++;
            else acc.bat++;
            if (p.isOverseas || p.overseas) acc.fr++;
            if (league === 'sa20') {
                if (isSa20UncappedAcquired(p)) acc.uncapped++;
            } else if (isU23Player(p)) {
                acc.u23++;
            }
            return acc;
        }, { bat: 0, bowl: 0, ar: 0, wk: 0, fr: 0, u23: 0, uncapped: 0 });

        // Explicitly pick fields to avoid circularity or excessive payload size
        return {
            franchiseId: t.franchiseId,
            teamName: t.teamName,
            teamThemeColor: t.teamThemeColor,
            teamLogo: t.teamLogo,
            ownerName: t.ownerName,
            ownerUserId: t.ownerUserId,
            ownerSocketId: t.ownerSocketId,
            currentPurse: t.currentPurse,
            isBot: !!t.isBot,
            acquiredCount: t.playersAcquired?.length || 0,
            roleCounts: counts,
            rtmCards: t.rtmCards || 0,
            rtmUsedCount: t.rtmUsedCount || 0,
            // Only include minimal data for acquired players if needed, or omit if count/roles are enough
            playersAcquired: (t.playersAcquired || []).map(p => ({
                name: p.name,
                role: p.role,
                boughtFor: p.boughtFor,
                isOverseas: p.isOverseas,
                age: p.age,
                isU23: league === 'sa20' ? false : isU23Player(p),
                isUncapped: league === 'sa20' ? isSa20UncappedAcquired(p) : !!p.isUncapped,
                poolID: p.poolID,
                poolName: p.poolName
            }))
        };
    });
}

function getPresignedByTeam(state) {
    return {};
}

function canonicalizePlayerName(name) {
    if (!name) return '';
    return name.trim().toLowerCase()
        .replace(/\bdu\b/g, 'du')
        .replace(/donavon/g, 'donovan')
        .replace(/[^a-z0-9]/g, '');
}

function isModerator(state, socketId, userId) {
    if (!state) return false;
    const isPrimary = (userId && state.hostUserId === userId) || state.host === socketId;
    const isCoHost = userId && state.coHostUserIds && state.coHostUserIds.includes(userId);
    return isPrimary || isCoHost;
}

// ── Retention helpers ─────────────────────────────────────────────────────────

/** Returns the correct retention service functions for a given league. */
function getRetentionHelpers(league) {
    if (league === 'wpl') {
        return {
            getPrevSquads:  getWPLPrevSquads,
            validateFn:     validateWPLRetentions,
            calculateFn:    calculateWPLRetentionCosts,
            isUncappedFn:   isWPLUncappedPlayer,
        };
    } else { // sa20
        return {
            getPrevSquads:  getSA20PrevSquads,
            validateFn:     validateRetentions,
            calculateFn:    calculateRetentionCosts,
            isUncappedFn:   isUncappedPlayer,
        };
    }
}

// ── Known Overseas Players Sets (Static cache for robust previous season retentions check) ──
const WPL_OVERSEAS = new Set([
    'Alana King', 'Alice Capsey', 'Alyssa Healy', 'Amelia Kerr', 'Annabel Sutherland',
    'Ashleigh Gardner', 'Beth Mooney', 'Charli Knott', 'Chinelle Henry', 'Chloe Tryon',
    'Dane van Niekerk', 'Dani Wyatt', 'Danielle Gibson', 'Danni Wyatt', 'Danni Wyatt-Hodge',
    'Deandra Dottin', 'Ellyse Perry', 'Erin Burns', 'Georgia Voll', 'Georgia Wareham',
    'Grace Harris', 'Hayley Matthews', 'Heather Graham', 'Heather Knight', 'Issy Wong',
    'Jess Jonassen', 'Kate Cross', 'Kathryn Bryce', 'Kim Garth', 'Laura Harris',
    'Laura Wolvaardt', 'Lauren Bell', 'Linsey Smith', 'Lizelle Lee', 'Lucy Hamilton',
    'Marizanne Kapp', 'Meg Lanning', 'Megan Schutt', 'Milly Illingworth', 'Nadine de Klerk',
    'Nat Sciver-Brunt', 'Nicola Carey', 'Phoebe Litchfield', 'Sarah Bryce', 'Shabnim Ismail',
    'Sophia Dunkley', 'Sophie Devine', 'Sophie Ecclestone', 'Sophie Molineux', 'Tahlia McGrath',
    'Tara Norris'
]);

const SA20_OVERSEAS = new Set([
    'AM Ghazanfar', 'Adam Milne', 'Adam Rossington', 'Adil Rashid', 'Akeal Hosein',
    'Akila Dananjaya', 'Alzarri Joseph', 'Andre Russell', 'Asa Tribe', 'Azmatullah Omarzai',
    'Ben McDermott', 'Ben Stokes', 'Brandon King', 'Brydon Carse', 'Chris Benjamin',
    'Chris Woakes', 'Chris Wood', 'Christopher Benjamin', 'Craig Overton', 'Dan Lawrence',
    'Daniel Worrall', 'David Wiese', 'David Willey', 'Dawid Malan', 'Dilshan Madushanka',
    'Doug Bracewell', 'Dunith Wellalage', 'Eoin Morgan', 'Eshan Malinga', 'Evin Lewis',
    'Fabian Allen', 'George Garton', 'Gudakesh Motie', 'Harry Brook', 'James Coles',
    'James Fuller', 'James Neesham', 'James Vince', 'Jason Holder', 'Jason Roy',
    'Joe Root', 'Jofra Archer', 'John Turner', 'Johnson Charles', 'Jonny Bairstow',
    'Jordan Cox', 'Jos Buttler', 'Josh Little', 'Kieron Pollard', 'Kusal Mendis',
    'Kyle Mayers', 'Lewis Gregory', 'Liam Dawson', 'Liam Livingstone', 'Lorcan Tucker',
    'Maheesh Theekshana', 'Marcus Stoinis', 'Mason Crane', 'Matheesha Pathirana',
    'Matthew Potts', 'Matthew Wade', 'Moeen Ali', 'Mujeeb Ur Rahman', 'Naveen-ul-Haq',
    'Nicholas Pooran', 'Noor Ahmad', 'Nuwan Thushara', 'Obed McCoy', 'Odean Smith',
    'Olly Stone', 'Paul Stirling', 'Phil Salt', 'Rahmanullah Gurbaz', 'Rashid Khan',
    'Reece Topley', 'Richard Gleeson', 'Romario Shepherd', 'Sam Cook', 'Sam Curran',
    'Sam Hain', 'Saqib Mahmood', 'Shamar Joseph', 'Sherfane Rutherford', 'Sikandar Raza',
    'Sunil Narine', 'Taijul Islam', 'Tim David', 'Tom Abell', 'Tom Banton',
    'Tom Moores', 'Trent Boult', 'Vishen Halambage', 'Waqar Salamkheil', 'Wayne Madsen',
    'Will Jacks', 'Will Smeed', 'Zahir Khan', 'Zak Crawley'
]);

/**
 * Helper function to check if a historical player is an overseas player.
 * Checks static lists of known overseas players first, then falls back to MongoDB collections.
 */
async function checkIsOverseas(playerName, league) {
    if (!playerName) return false;
    const pName = playerName.trim();
    
    // First, check static sets for instant synchronous hit
    if (league === 'wpl' && WPL_OVERSEAS.has(pName)) return true;
    if (league === 'sa20' && SA20_OVERSEAS.has(pName)) return true;

    // Fall back to database query if not in static list
    const collections = getCollectionsForLeague(league);
    const dbName = league === 'sa20' ? 'SA20' : league;
    
    try {
        const db = mongoose.connection.client.db(dbName);
        const parts = pName.replace(/\s+/g, ' ').split(' ');
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');

        for (const collName of collections) {
            const doc = await db.collection(collName).findOne({
                $or: [
                    { player: pName },
                    { name: pName },
                    { Player: pName },
                    {
                        $and: [
                            { $or: [{ "First Name": firstName }, { First_Name: firstName }, { firstName: firstName }] },
                            { $or: [{ Surname: lastName }, { surname: lastName }] }
                        ]
                    }
                ]
            });
            if (doc) {
                if (doc.isOverseas !== undefined) return !!doc.isOverseas;
                const nat = String(doc.Country || doc.nationality || doc.Nationality || '').toLowerCase().trim();
                if (league === 'sa20') {
                    return nat !== '' && !['rsa', 'south africa', 'sa'].includes(nat);
                } else {
                    return nat !== '' && !['india', 'indian', 'ind'].includes(nat);
                }
            }
        }
    } catch (e) {
        console.error(`[checkIsOverseas] Database query error for ${pName}:`, e.message);
    }
    return false;
}

/**
 * Annotates raw squad data (array of strings) with isUncapped and isOverseas flags.
 * Returns { [teamName]: [{name, isUncapped, isOverseas}, ...] }
 */
async function annotateSquads(squads, isUncappedFn, league) {
    if (!squads) return null;
    const result = {};
    const promises = [];
    for (const [teamName, players] of Object.entries(squads)) {
        result[teamName] = [];
        for (const name of players) {
            promises.push((async () => {
                const isOverseas = await checkIsOverseas(name, league);
                result[teamName].push({
                    name,
                    isUncapped: isUncappedFn(name),
                    isOverseas
                });
            })());
        }
    }
    await Promise.all(promises);
    return result;
}

/**
 * Finds a team's retention squad from annotated retentionSquads,
 * normalizing team names via the league's name map.
 */
function findTeamRetentionSquad(state, gameTeamName) {
    const { retentionSquads, league } = state;
    if (!retentionSquads) return null;
    // Direct lookup
    if (retentionSquads[gameTeamName]) return retentionSquads[gameTeamName];
    // Normalized lookup
    let normalizedName = gameTeamName;
    if (league === 'sa20' && TEAM_NAME_MAP[gameTeamName])          normalizedName = TEAM_NAME_MAP[gameTeamName];
    else if (league === 'wpl' && WPL_TEAM_NAME_MAP[gameTeamName])  normalizedName = WPL_TEAM_NAME_MAP[gameTeamName];
    else if (league === 'ipl' && IPL_TEAM_NAME_MAP[gameTeamName])  normalizedName = IPL_TEAM_NAME_MAP[gameTeamName];
    return retentionSquads[normalizedName] || null;
}

function getMaxRtmSlots(league) {
    if (league === 'wpl') return 4;
    if (league === 'sa20') return 5;
    return 0;
}

function getTeamRtmCards(state, teamName) {
    if (!state || !teamName) return 0;
    if (state.league !== 'wpl' && state.league !== 'sa20') return 0;
    if (!state.retentionSquads) return 0;

    const squad = findTeamRetentionSquad(state, teamName);
    if (!squad) return 0;

    const selected = state.retentionsByTeam?.[teamName] || [];
    const helpers = getRetentionHelpers(state.league);
    const maxPossible = getMaxRtmSlots(state.league);
    let cards = Math.max(0, maxPossible - selected.length + 1);

    const retainedUncapped = selected.some((n) => helpers.isUncappedFn(n));
    if (!retainedUncapped) {
        cards = Math.max(cards, 1);
    }

    return cards;
}

function ensureTeamRtmFields(state, team) {
    if (!team) return;
    team.rtmUsedCount = team.rtmUsedCount || 0;
    team.rtmCards = getTeamRtmCards(state, team.teamName);
}

// ─────────────────────────────────────────────────────────────────────────────

// Helper to emit consistent, full state to all room participants
async function emitFullAuctionState(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state) return;

    let remainingTime;
    if (state.status === 'RTM') {
        remainingTime = state.rtmState?.timer || 0;
    } else {
        remainingTime = calculateRemainingTime(state);
    }

    io.to(roomCode).emit('auction_state_sync', {
        status: state.status,
        currentIndex: state.currentIndex,
        currentPlayer: state.currentPlayer,
        currentBid: state.currentBid,
        timer: Math.max(0, remainingTime),
        timerDuration: state.timerDuration,
        teams: lightweightTeams(state.teams, state.league),
        last5Bids: state.last5Bids || [],
        rtmState: state.rtmState || null
    });
}

function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function loadFranchises(targetLeague) {
    const db = getDb(targetLeague);
    let dbFranchises = [];
    try {
        dbFranchises = await db.collection('franchises').find().toArray();
    } catch (e) {
        console.log(`[DATA] Failed to query franchises from ${targetLeague} DB:`, e.message);
    }

    let normalizedFranchises = [];

    if (dbFranchises && dbFranchises.length > 0) {
        normalizedFranchises = dbFranchises.map(f => {
            let logoUrl = f.logoUrl || f.logo_url || f.teamLogo || '';
            if (logoUrl.startsWith('/logos/')) {
                logoUrl = logoUrl.replace('/logos/', '/ipl_logos/');
            }
            return {
                _id: f._id,
                name: f.name,
                shortName: f.shortName,
                primaryColor: f.primaryColor,
                logoUrl: logoUrl,
                purseLimit: targetLeague === 'sa20' ? 410 : (f.purseLimit || (targetLeague === 'wpl' ? 1500 : 12000))
            };
        });
    } else {
        console.log(`[DATA] Franchise collection empty, using hardcoded fallback for ${targetLeague}`);
        const fallbacks = targetLeague === 'sa20' ? SA20_TEAMS : (targetLeague === 'wpl' ? WPL_TEAMS : IPL_TEAMS);
        normalizedFranchises = fallbacks.map(t => {
            let logoUrl = t.logoUrl || '';
            if (logoUrl.startsWith('/logos/')) {
                logoUrl = logoUrl.replace('/logos/', '/ipl_logos/');
            }
            return {
                _id: new mongoose.Types.ObjectId(),
                name: t.name,
                shortName: t.id,
                primaryColor: t.color,
                logoUrl: logoUrl,
                purseLimit: targetLeague === 'sa20' ? 410 : (targetLeague === 'wpl' ? 1500 : 12000)
            };
        });
    }
    return normalizedFranchises;
}

async function rehydrateRoomState(roomCode) {
    console.log(`[SESSION] Attempting re-hydration for room ${roomCode}...`);
    try {
        // Try ActiveRoom first (new fault-tolerant model)
        let roomDoc = await ActiveRoom.findOne({ roomCode }).lean();
        
        // Fallback to legacy AuctionRoom if not found in ActiveRoom yet
        if (!roomDoc) {
            roomDoc = await AuctionRoom.findOne({ roomId: roomCode }).lean();
            if (roomDoc) {
                console.log(`[SESSION] Converting legacy AuctionRoom ${roomCode} to ActiveRoom...`);
                // Initialize ActiveRoom from legacy data
                roomDoc = await ActiveRoom.create({
                    roomCode: roomDoc.roomId,
                    purseLimit: roomDoc.purseLimit,
                    isAiMode: roomDoc.isAiMode,
                    league: roomDoc.league || 'ipl',
                    currency: roomDoc.currency || 'inr',
                    teamCount: roomDoc.teamCount || (roomDoc.franchisesInRoom || []).length,
                    hostUserId: roomDoc.hostUserId,
                    coHostUserIds: roomDoc.coHostUserIds || [],
                    teams: (roomDoc.franchisesInRoom || []).map(t => {
                        let logo = t.logoUrl || t.teamLogo || '';
                        if (logo.startsWith('/logos/')) {
                            logo = logo.replace('/logos/', '/ipl_logos/');
                        }
                        return {
                            franchiseId: t.franchiseId,
                            teamName: t.teamName,
                            teamThemeColor: t.teamThemeColor,
                            teamLogo: logo, // Mapped from logoUrl in AuctionRoom
                            ownerUserId: t.ownerUserId,
                            ownerSocketId: t.ownerSocketId,
                            currentPurse: t.currentPurse,
                            isBot: !!t.isBot
                        };
                    }),
                    auctionStatus: roomDoc.status === 'Auctioning' ? 'ONGOING' : roomDoc.status,
                    currentIndex: roomDoc.currentPlayerIndex,
                    auctionYear: roomDoc.auctionYear
                });
            }
        }

        if (!roomDoc) {
            console.warn(`[SESSION] Re-hydration failed: Room ${roomCode} not found in DB`);
            return null;
        }

        const targetLeague = roomDoc.league || 'ipl';
        const allPlayers = await fetchAllPlayers(targetLeague);
        const normalizedFranchises = await loadFranchises(targetLeague);

        // Map team logos for existing teams to ensure correct path
        const mappedTeams = (roomDoc.teams || []).map(t => {
            let logo = t.teamLogo || t.logoUrl || '';
            if (logo.startsWith('/logos/')) {
                logo = logo.replace('/logos/', '/ipl_logos/');
            }
            return {
                ...t,
                teamLogo: logo
            };
        });

        // Filter availableTeams to exclude those already claimed in teams list
        const claimedNames = mappedTeams.map(t => t.teamName);
        const availableTeams = normalizedFranchises.filter(f => !claimedNames.includes(f.name));
        
        roomStates[roomCode] = {
            roomCode: roomDoc.roomCode || roomDoc.roomId,
            roomType: roomDoc.type || 'private',
            isAiMode: roomDoc.isAiMode || false,
            league: targetLeague,
            hostUserId: roomDoc.hostUserId,
            status: roomDoc.auctionStatus || roomDoc.status || 'Lobby',
            players: allPlayers,
            currentIndex: roomDoc.currentIndex || roomDoc.currentPlayerIndex || 0,
            teams: mappedTeams,
            spectators: [],
            joinRequests: [],
            availableTeams: availableTeams,
            coHostUserIds: roomDoc.coHostUserIds || [],
            currentBid: roomDoc.currentBid || {
                amount: roomDoc.currentBidAmount || 0,
                teamId: roomDoc.highestBidderTeamId,
                teamName: null
            },
            currentPlayer: roomDoc.currentPlayer || null,
            timer: 0,
            timerDuration: roomDoc.timerDuration || (roomDoc.purseLimit === 12000 ? 10 : 15),
            lastBidTime: roomDoc.lastBidTime || new Date(),
            isReAuctionRound: false,
            unsoldHistory: roomDoc.unsoldHistory || [],
            auctionYear: roomDoc.auctionYear
        };

        // Reconstruct retention squads on rehydrate for WPL and SA20
        if (roomDoc.auctionYear && (targetLeague === 'wpl' || targetLeague === 'sa20')) {
            const firstYear = '2023';
            if (roomDoc.auctionYear !== firstYear) {
                const retHelpers = getRetentionHelpers(targetLeague);
                const rawSquads = retHelpers.getPrevSquads(roomDoc.auctionYear);
                const annotatedSquads = rawSquads ? await annotateSquads(rawSquads, retHelpers.isUncappedFn, targetLeague) : null;
                roomStates[roomCode].retentionSquads = annotatedSquads;
            }
        }

        console.log(`[SESSION] Room ${roomCode} re-hydrated successfully. Status: ${roomStates[roomCode].status}`);
        return roomStates[roomCode];
    } catch (err) {
        console.error(`[SESSION] Re-hydration error for ${roomCode}:`, err);
        return null;
    }
}

/**
 * calculateRemainingTime — Recovers timer from DB timestamps
 */
function calculateRemainingTime(state) {
    if (!state) return 0;
    const now = Date.now();
    // Bug 5 fix: prefer timerEndsAt (set on every bid/resume/load) over
    // lastBidTime-based calculation which diverges after pauses/resumes.
    if (state.timerEndsAt) {
        return Math.ceil((state.timerEndsAt - now) / 1000);
    }
    // Legacy fallback for re-hydrated rooms that only have lastBidTime
    if (!state.lastBidTime) return 0;
    const lastBid = new Date(state.lastBidTime).getTime();
    const elapsed = (now - lastBid) / 1000;
    return Math.ceil(state.timerDuration - elapsed);
}

/**
 * resumeAuction — Safely restarts an auction room's loop (survive server restart)
 */
function resumeAuction(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || state.status !== 'ONGOING') return;

    // Prevent duplicate timers
    if (roomTimers[roomCode]) {
        clearInterval(roomTimers[roomCode]);
        delete roomTimers[roomCode];
    }

    const remaining = calculateRemainingTime(state);
    console.log(`[RESUME] Room ${roomCode} resuming with ${remaining}s left on ${state.currentPlayer?.name || 'unknown player'}`);
    
    state.timer = remaining;
    
    if (state.timer <= 0) {
        console.log(`[RESUME] Room ${roomCode} finalize immediately (timer expired).`);
        checkAndTriggerRTM(roomCode, io);
        return;
    }

    // Set DB lock
    ActiveRoom.updateOne({ roomCode }, { $set: { isTimerRunning: true } }).exec();

    roomTimers[roomCode] = setInterval(() => tickAuctionTimer(roomCode, io), 1000);
}

/**
 * persistActiveState — Efficiently saves core auction state to MongoDB
 */
async function persistActiveState(roomCode) {
    const state = roomStates[roomCode];
    if (!state) return;

    try {
        await ActiveRoom.findOneAndUpdate(
            { roomCode },
            {
                $set: {
                    auctionStatus: state.status,
                    currentIndex: state.currentIndex,
                    currentPlayer: state.currentPlayer,
                    currentBid: state.currentBid,
                    timerDuration: state.timerDuration,
                    lastBidTime: state.lastBidTime,
                    hostUserId: state.hostUserId,
                    coHostUserIds: state.coHostUserIds,
                    unsoldHistory: state.unsoldHistory, // Preserve top unsold list
                    teams: state.teams // Sync purses/acquired updates
                }
            },
            { upsert: true }
        );
    } catch (err) {
        console.error(`[DB] Failed to persist active state for ${roomCode}:`, err.message);
    }
}

function ensureArray(val) {
    if (Array.isArray(val)) return val;
    if (!val) return [];
    if (typeof val === 'object') return Object.values(val);
    if (typeof val === 'string') {
        if (val.includes(',') && !val.trim().startsWith('http')) return val.split(',').map(v => v.trim());
        return [val];
    }
    return [String(val)];
}

async function handleAuctionEndTransition(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || state.status === 'Selection' || state.status === 'Finished') return;

    // Explicitly pause the auction to stop any background bid timers
    state.status = 'Paused';
    if (roomTimers[roomCode]) {
        clearInterval(roomTimers[roomCode]);
        delete roomTimers[roomCode];
    }
    
    // Clear any active end requests so the UI unsticks
    if (state.endRequest) {
        delete state.endRequest;
        io.to(roomCode).emit('auction_end_cancelled');
    }

    // [NEW] AI Mode Bypass: Skip interest voting and re-auction rounds
    if (state.isAiMode) {
        console.log(`[AI-MODE] Skipping interest voting/re-auction for room ${roomCode}. Moving to finalization.`);
        finalizeResults(roomCode, io);
        return;
    }

    // --- EXHAUSTION SKIP ---
    // If every team is already exhausted, skip interest voting and re-auction
    const remainingPlayers = state.players.slice(state.currentIndex);
    const lowestRemainingPrice = remainingPlayers.length > 0 
        ? Math.min(...remainingPlayers.map(p => p.basePrice || 20)) 
        : 20;

    const maxSquad = state.league === 'wpl' ? 18 : (state.league === 'sa20' ? 19 : 25);
    const allExhausted = state.teams.length > 0 && state.teams.every(t => {
        return t.playersAcquired.length >= maxSquad || t.currentPurse < lowestRemainingPrice;
    });

    if (allExhausted) {
        console.log(`[TRANSITION] All teams exhausted in room ${roomCode}. Skipping voting/re-auction.`);
        finalizeResults(roomCode, io);
        return;
    }

    const { selectPlaying11AndImpact } = require('../services/aiRating');

    // 1. Identify players for the INTEREST VOTING phase (Phase 1)
    // Only players from Pool 3 & 4 or Unsold History go to voting
    // [FIX] Using poolID instead of poolName to match data structure
    const isWpl = state.league === 'wpl';
    const pool3And4 = state.players.slice(state.currentIndex).filter(p => {
        const pid = (p.poolID || "").toLowerCase();
        if (isWpl) {
            return pid.includes('uncapped');
        }
        return pid.includes('pool3') || pid.includes('pool4');
    });
    const unsoldPlayers = state.unsoldHistory || [];
    const votingCandidateDetails = [...pool3And4, ...unsoldPlayers];

    // CRITICAL: Filter out players that are ALREADY in the voting session to avoid duplicates
    const votingCandidates = votingCandidateDetails.map(p => ({
        id: String(p._id || p.id),
        name: p.player || p.name,
        poolID: p.poolID || p.originalPool, // Maintain pool reference
        basePrice: p.basePrice || p.base_price
    }));

    if (votingCandidates.length > 0) {
        state.votingSession = {
            active: true,
            players: votingCandidates,
            playersData: votingCandidateDetails,
            votes: {},
            timer: 240,
            isFinal: true
        };

        io.to(roomCode).emit('interest_voting_started', {
            players: state.votingSession.players,
            timer: 240,
            isFinal: true
        });

        // Auto-calculate after timer expires
        if (state.votingTimeout) clearTimeout(state.votingTimeout);
        state.votingTimeout = setTimeout(() => {
            const refreshedState = roomStates[roomCode];
            if (refreshedState && refreshedState.votingSession && refreshedState.votingSession.active) {
                processVotingResults(roomCode, io);
            }
        }, 240500);
        return;
    }

    // Phase 2: Start the actual Re-Auction with players who survived final voting
    if (!state.isReAuctionRound) {
        if (state.players.length > state.currentIndex) {
            console.log(`\n--- STARTING RE-AUCTION ROUND FOR ${state.players.length - state.currentIndex} SURVIVING PLAYERS ---`);
            state.isReAuctionRound = true;
            state.currentIndex = 0;

            io.to(roomCode).emit('receive_chat_message', {
                id: Date.now(),
                senderName: 'System',
                senderTeam: 'System',
                senderColor: '#ef4444',
                message: "Starting Re-Auction for players who received interest. Get ready!",
                timestamp: new Date().toLocaleTimeString()
            });

            // Start re-auction with a short pause
            setTimeout(() => {
                const refreshedState = roomStates[roomCode];
                if (refreshedState && refreshedState.players.length > 0) {
                    refreshedState.status = 'Auctioning';
                    refreshedState.timer = 10;
                    refreshedState.timerEndsAt = Date.now() + 10000;
                    io.to(roomCode).emit('auction_resumed', { state: refreshedState });
                    loadNextPlayer(roomCode, io);
                } else {
                    finalizeResults(roomCode, io);
                }
            }, 5000);
            return;
        }
    }

    // Phase 3: Finalization
    finalizeResults(roomCode, io);
}

/**
 * finalizeManualEnd — Skips all voting and goes straight to selection
 * This is triggered by a host manual end with player acknowledgement.
 */
function finalizeManualEnd(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state) return;

    // Prevent overriding if already finalizing, evaluating, or finished
    if (state.status === 'Finished' || state.status === 'Evaluating' || state.isFinalizing) {
        console.log(`[MANUAL-END] Ignored. Room ${roomCode} is already in state: ${state.status}`);
        return;
    }

    console.log(`[MANUAL-END] Finalizing auction for room ${roomCode}. Skipping voting.`);
    
    // Stop all timers
    if (roomTimers[roomCode]) {
        clearInterval(roomTimers[roomCode]);
        delete roomTimers[roomCode];
    }

    state.status = 'Paused';
    io.to(roomCode).emit('receive_chat_message', {
        id: Date.now(),
        senderName: 'System',
        senderTeam: 'System',
        senderColor: '#ef4444',
        message: "Auction closed by Host. Crunching numbers and finalizing squads...",
        timestamp: new Date().toLocaleTimeString()
    });

    // Move to finalization phase directly
    setTimeout(() => {
        finalizeResults(roomCode, io);
    }, 2000);
}


async function runTeamAiEvaluation(state) {
    const { evaluateAllTeams } = require('../services/aiRating');

    await Promise.all(state.teams.map(async (team, index) => {
        const playersAcquired = team.playersAcquired || [];

        const richPlayers = await Promise.all(playersAcquired.map(async (p) => {
            const data = await findPlayerById(p.player, state.league || 'ipl');
            const nat = (data?.nationality || "").toLowerCase().trim();
            const isOverseas = Boolean(nat && !["india", "indian", "ind"].includes(nat));

            const age = Number(data?.age || data?.Age || p.age || p.Age || 0);
            const isU23Val = state.league !== 'sa20' && (
                data?.isU23 || p.isU23 || (age > 0 && age <= 23) ||
                String(data?.poolID || data?.poolName || p.poolID || p.poolName || '').toLowerCase().includes('emerging') ||
                String(data?.poolID || data?.poolName || p.poolID || p.poolName || '').toLowerCase().includes('rookie')
            );

            const merged = {
                ...p,
                ...data,
                name: data?.player || data?.name || p.name,
                poolID: data?.poolID || p.poolID,
                poolName: data?.poolName || p.poolName,
            };

            return {
                player: p.player,
                name: merged.name,
                role: data?.role,
                nationality: data?.nationality,
                image_path: data?.image_path || data?.imagepath || data?.photoUrl,
                isOverseas: isOverseas,
                boughtFor: p.boughtFor,
                points: data?.points || p.points || 0,
                stats: data?.stats || {},
                age: age > 0 ? age : undefined,
                isU23: !!isU23Val,
                isUncapped: state.league === 'sa20' ? isSa20UncappedAcquired(merged) : undefined,
                poolID: merged.poolID,
                poolName: merged.poolName
            };
        }));
        state.teams[index].playersAcquired = richPlayers;
    }));

    const minSquadSize = state.league === 'wpl' ? 15 : (state.league === 'sa20' ? 17 : 15);

    const qualifiedTeams = state.teams.filter(t => {
        const size = t.playersAcquired?.length || 0;
        if (size < minSquadSize) return false;
        if (state.league === 'sa20') {
            const uncappedCount = (t.playersAcquired || []).filter(p => isSa20UncappedAcquired(p)).length;
            if (uncappedCount < 2) return false;
        }
        return true;
    });

    const disqualifiedTeams = state.teams.filter(t => !qualifiedTeams.includes(t));

    disqualifiedTeams.forEach(t => {
        const idx = state.teams.findIndex(st => st.teamName === t.teamName);
        const size = t.playersAcquired?.length || 0;

        let reason = `DISQUALIFIED: Squad size requirement (min ${minSquadSize}) not met.`;
        let fixMessage = `Recruit more players to meet the minimum squad size of ${minSquadSize}.`;

        if (state.league === 'sa20') {
            const uncappedCount = (t.playersAcquired || []).filter(p => isSa20UncappedAcquired(p)).length;
            if (size < 17) {
                reason = "DISQUALIFIED: SA20 Squad size requirement (min 17 players) not met.";
            } else if (uncappedCount < 2) {
                reason = `DISQUALIFIED: SA20 Squad uncapped requirement (min 2 players, found ${uncappedCount}) not met.`;
                fixMessage = "Ensure you draft and include at least 2 uncapped (domestic) players in your squad.";
            }
        }

        state.teams[idx].evaluation = {
            score: 0,
            overallScore: 0,
            titleProbability: "Weak",
            analysis: {
                batting_narrative: reason,
                bowling_narrative: "Squad has failed key roster eligibility rules.",
                tactical_balance: "Insufficient squad depth or dynamic eligibility compliance.",
                key_risks_and_fixes: fixMessage
            }
        };
    });

    let evaluatedResults = [];
    if (qualifiedTeams.length > 0) {
        console.log(`[AI-BATCH] Dispatching unified analysis for ${qualifiedTeams.length} teams.`);
        evaluatedResults = await evaluateAllTeams(qualifiedTeams.map(t => ({
            teamId: t.teamName,
            teamName: t.teamName,
            playersAcquired: t.playersAcquired,
            currentPurse: t.currentPurse
        })));
    }

    state.teams.forEach((t, idx) => {
        const res = evaluatedResults.find(r => r.teamId === t.teamName);
        if (res) {
            state.teams[idx].evaluation = res.evaluation;

            if (res.bestXI && res.bestXI.playing11) {
                const findId = (name) => {
                    const p = t.playersAcquired.find(pa => pa.name === name);
                    return p ? p.player : null;
                };
                state.teams[idx].playing11 = res.bestXI.playing11.map(name => findId(name)).filter(id => id);
                state.teams[idx].impactPlayers = res.bestXI.impactPlayers.map(name => findId(name)).filter(id => id);
            }
        }
    });
}

async function runQuizPhase(roomCode, io, state) {
    const QUESTION_DURATION = 12;
    const REVEAL_PAUSE = 2;
    const questions = state.quiz.questions;

    const getExpectedQuizResponders = () => {
        const responderIds = new Set();
        (state.teams || []).forEach((team) => {
            if (team?.isBot) return;
            if (team?.ownerUserId) responderIds.add(team.ownerUserId);
            else if (team?.ownerSocketId) responderIds.add(team.ownerSocketId);
        });
        return Math.max(1, responderIds.size);
    };

    const closeCurrentQuizQuestion = (index) => {
        if (!state.quiz || !state.quiz.active) return false;
        if (state.quiz.currentQuestionIndex !== index) return false;
        if (state.quiz.questionClosed) return false;

        state.quiz.questionClosed = true;

        if (state.quiz.questionTimerInterval) {
            clearInterval(state.quiz.questionTimerInterval);
            state.quiz.questionTimerInterval = null;
        }

        io.to(roomCode).emit('quiz_question_closed', {
            quizIndex: state.quiz.questions[index].quizIndex,
            correctIndex: state.quiz.questions[index].correctIndex,
            correctAnswer: state.quiz.questions[index].options[state.quiz.questions[index].correctIndex],
        });

        if (typeof state.quiz.questionResolver === 'function') {
            const resolve = state.quiz.questionResolver;
            state.quiz.questionResolver = null;
            resolve();
        }
        return true;
    };

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        state.quiz.currentQuestionIndex = i;
        state.quiz.questionStartedAt = Date.now();
        state.quiz.questionClosed = false;
        state.quiz.currentQuestionAnsweredBy = new Set();

        io.to(roomCode).emit('quiz_question', getSafeQuizQuestion(q, i, questions.length, QUESTION_DURATION));
        io.to(roomCode).emit('quiz_leaderboard_update', { leaderboard: buildQuizLeaderboard(state.quiz.scores) });

        const questionEnd = new Promise((resolve) => {
            state.quiz.questionResolver = resolve;
        });

        state.quiz.questionTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - state.quiz.questionStartedAt) / 1000);
            const remaining = Math.max(0, QUESTION_DURATION - elapsed);

            if (state.quiz.questionClosed) {
                clearInterval(state.quiz.questionTimerInterval);
                state.quiz.questionTimerInterval = null;
                return;
            }

            io.to(roomCode).emit('quiz_timer_tick', { remaining, questionNumber: i + 1, totalQuestions: questions.length });
            io.to(roomCode).emit('quiz_leaderboard_update', { leaderboard: buildQuizLeaderboard(state.quiz.scores) });

            if (remaining <= 0) {
                closeCurrentQuizQuestion(i);
            }
        }, 1000);

        await questionEnd;

        if (i < questions.length - 1) {
            await new Promise((r) => setTimeout(r, REVEAL_PAUSE * 1000));
        }
    }

    state.quiz.active = false;
    state.quizLeaderboard = buildQuizLeaderboard(state.quiz.scores);
    io.to(roomCode).emit('quiz_phase_ended', { leaderboard: state.quizLeaderboard });
}


async function finalizeResults(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state) return;
    if (state.status === 'Finished' || state.status === 'Evaluating' || state.status === 'Quiz' || state.isFinalizing) return;
    state.isFinalizing = true;

    io.to(roomCode).emit('receive_chat_message', {
        id: Date.now(),
        senderName: 'System',
        senderTeam: 'System',
        senderColor: '#ef4444',
        message: "Auction closed! Trivia showdown starting — then AI squad analysis.",
        timestamp: new Date().toLocaleTimeString()
    });

    // ── PHASE 1: QUIZ (dedicated page) ─────────────────────────────────────
    state.status = 'Quiz';
    const quizQuestions = generateQuiz(state.league || 'ipl');
    state.quiz = {
        active: true,
        questions: quizQuestions,
        currentQuestionIndex: -1,
        scores: {},
        questionStartedAt: null,
    };

    io.to(roomCode).emit('quiz_phase_started', {
        roomCode,
        league: state.league || 'ipl',
        totalQuestions: quizQuestions.length,
    });

    console.log(`[QUIZ] Phase started for room ${roomCode} (${quizQuestions.length} questions)`);
    await runQuizPhase(roomCode, io, state);
    console.log(`[QUIZ] Phase ended for room ${roomCode}`);

    // ── PHASE 2: AI EVALUATION LOBBY ─────────────────────────────────────
    state.status = 'Evaluating';
    const EVAL_DURATION = 90;
    state.evaluationTimer = EVAL_DURATION;
    state.evaluationTimerEndsAt = Date.now() + (EVAL_DURATION * 1000);

    io.to(roomCode).emit('evaluation_started', { timer: EVAL_DURATION });
    console.log(`[EVAL-TIMER] Evaluation lobby started for room ${roomCode} (${EVAL_DURATION}s)`);

    let evalDisplayTimer = EVAL_DURATION;
    const evalTimerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((state.evaluationTimerEndsAt - Date.now()) / 1000));
        if (evalDisplayTimer !== remaining) {
            evalDisplayTimer = remaining;
            io.to(roomCode).emit('evaluation_timer_tick', { timer: remaining });
        }
        if (remaining <= 0) clearInterval(evalTimerInterval);
    }, 500);

    try {
        io.to(roomCode).emit('receive_chat_message', {
            id: Date.now(),
            senderName: 'System',
            senderTeam: 'System',
            senderColor: '#ff0000',
            message: "Crunching numbers... Final team evaluations and rankings incoming!",
            timestamp: new Date().toLocaleTimeString()
        });

        await runTeamAiEvaluation(state);

        const timeToWaitMs = state.evaluationTimerEndsAt - Date.now();
        if (timeToWaitMs > 0) {
            console.log(`[EVAL-TIMER] AI completed early. Waiting ${Math.ceil(timeToWaitMs / 1000)}s...`);
            await new Promise((resolve) => setTimeout(resolve, timeToWaitMs));
        }

        state.status = 'Finished';
        const finalizedTeams = [...state.teams];

        finalizedTeams.sort((a, b) => (b.evaluation?.overallScore || 0) - (a.evaluation?.overallScore || 0));
        state.teams = finalizedTeams.map((t, i) => ({ ...t, rank: i + 1 }));

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await CompletedRoom.create({
            roomCode,
            summary: {
                totalPlayers: state.players.length,
                soldPlayers: state.teams.reduce((acc, t) => acc + (t.playersAcquired?.length || 0), 0)
            },
            results: state.teams.flatMap(t => (t.playersAcquired || []).map(p => ({
                playerName: p.name,
                soldTo: t.teamName,
                amount: p.boughtFor
            }))),
            expiresAt: expiresAt
        });

        await AuctionRoom.findOneAndUpdate(
            { roomId: roomCode },
            {
                $set: {
                    status: 'Finished',
                    franchisesInRoom: state.teams,
                    quizLeaderboard: state.quizLeaderboard || [],
                }
            }
        );

        await ActiveRoom.deleteOne({ roomCode });

        console.log(`--- AUCTION FINISHED AND PERSISTED FOR ROOM ${roomCode} ---`);
        io.to(roomCode).emit('auction_finished', {
            teams: state.teams,
            quizLeaderboard: state.quizLeaderboard || [],
        });

    } catch (err) {
        console.error("Critical Error in finalizeResults:", err);
        io.to(roomCode).emit('error', 'Failed to generate final results');
    }

    clearInterval(evalTimerInterval);
    if (roomTimers[roomCode]) {
        clearInterval(roomTimers[roomCode]);
        delete roomTimers[roomCode];
    }
}


function processVotingResults(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || !state.votingSession) return;

    const isFinal = !!state.votingSession.isFinal;
    const allVotedPlayerIds = new Set();
    for (const votedList of Object.values(state.votingSession.votes)) {
        if (Array.isArray(votedList)) {
            for (const id of votedList) {
                allVotedPlayerIds.add(String(id));
            }
        }
    }

    const totalInSession = (state.votingSession.players || []).length;
    const skippedCount = totalInSession - allVotedPlayerIds.size;
    const votingSessionIds = (state.votingSession.players || []).map(p => p.id);

    if (isFinal) {
        const survivedPlayers = (state.votingSession.playersData || []).filter(p => allVotedPlayerIds.has(String(p._id || p.id)));
        state.players = survivedPlayers;
        state.currentIndex = 0;
    } else {
        const skippedFromThisSession = [];
        state.players = (state.players || []).filter(p => {
            const pid = String(p._id);
            const isPart = votingSessionIds.includes(pid);
            const isVoted = allVotedPlayerIds.has(pid);

            if (isPart && !isVoted) {
                skippedFromThisSession.push(p);
                return false;
            }
            return true;
        });

        if (!state.skippedHistory) state.skippedHistory = [];
        state.skippedHistory.push(...skippedFromThisSession.map(p => ({ ...p, isSkipped: true, originalPool: p.poolName })));
    }

    state.votingSession.active = false;

    io.to(roomCode).emit('interest_voting_completed', {
        skippedCount,
        isFinal,
        message: isFinal
            ? `Final voting completed. ${skippedCount} players permanently removed. Starting re-auction...`
            : `Accelerated voting completed. ${skippedCount} players permanently skipped.`
    });

    if (isFinal) {
        setTimeout(() => {
            const refreshedState = roomStates[roomCode];
            if (refreshedState && refreshedState.players.length > 0) {
                refreshedState.status = 'Auctioning';
                refreshedState.isReAuctionRound = true;
                refreshedState.timer = 10;
                refreshedState.timerEndsAt = Date.now() + 10000;
                io.to(roomCode).emit('auction_resumed', { state: refreshedState });
                loadNextPlayer(roomCode, io);
            } else {
                finalizeResults(roomCode, io);
            }
        }, 3000);
    } else if (state.wasRunningBeforeVoting) {
        state.wasRunningBeforeVoting = false;
        state.status = 'Auctioning';

        if (state.timer > 0 && state.currentIndex < (state.players || []).length) {
            state.timerEndsAt = Date.now() + (state.timer * 1000);
            if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);
            // Bug 4 fix: was calling non-existent tickTimer — use tickAuctionTimer
            roomTimers[roomCode] = setInterval(() => {
                tickAuctionTimer(roomCode, io);
            }, 1000);
            io.to(roomCode).emit('auction_resumed', { timer: state.timer });
        }
    }
}

const setupSocketHandlers = (io) => {

    // --- JWT Authentication Middleware ---
    // Every socket connection must carry a valid JWT in socket.handshake.auth.token
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            // Allow connection without token for backward compat (guest mode)
            // but they won't be able to own teams
            socket.userId = null;
            socket.playerName = 'Anonymous';
            return next();
        }
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.userId;
            socket.playerName = decoded.playerName;
            return next();
        } catch (err) {
            console.warn(`[SESSION] Invalid JWT from socket ${socket.id}: ${err.message}`);
            // Still allow connection but mark as unauthenticated
            socket.userId = null;
            socket.playerName = 'Anonymous';
            return next();
        }
    });

    // Helper to broadcast active public rooms to all users currently in the Lobby menu
    const broadcastPublicRooms = () => {
        io.emit('public_rooms_update', getPublicRoomsList());
    };

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id} (userId: ${socket.userId || 'guest'}, name: ${socket.playerName})`);


        // Initial fetch for a newly connected client who is sitting in the lobby
        socket.on('fetch_public_rooms', ({ league } = {}) => {
            socket.emit('public_rooms_update', getPublicRoomsList(league));
        });

        // Create Room (Host)
        socket.on('create_room', async ({ roomType = 'private', league = 'ipl', currency, auctionYear }) => {
            // Read identity from the JWT-verified socket properties
            const playerName = socket.playerName;
            const userId = socket.userId;
            const isAiMode = roomType === 'ai';
            const effectiveRoomType = isAiMode ? 'private' : roomType;
            const targetLeague = normalizeLeague(league);

            // Default currencies: INR for IPL/WPL, ZAR for SA20. User can override with 'usd'.
            const defaultCurrency = targetLeague === 'sa20' ? 'zar' : 'inr';
            const validCurrencies = ['inr', 'usd', 'zar'];
            const targetCurrency = validCurrencies.includes(String(currency || '').toLowerCase()) ? String(currency).toLowerCase() : defaultCurrency;

            try {
                const roomCode = generateRoomCode();

                // ── All-league retention setup ─────────────────────────────────
                const LEAGUE_VALID_YEARS = {
                    ipl: ['2022', '2023', '2024', '2025'],
                    wpl: ['2023', '2024', '2025', '2026'],
                    sa20: ['2023', '2024', '2025', '2026'],
                };
                const LEAGUE_FIRST_YEAR = { ipl: '2022', wpl: '2023', sa20: '2023' };
                const validYears = LEAGUE_VALID_YEARS[targetLeague] || [];
                const targetYear  = validYears.includes(String(auctionYear)) ? String(auctionYear) : null;
                const firstYear   = LEAGUE_FIRST_YEAR[targetLeague];
                const retHelpers  = getRetentionHelpers(targetLeague);
                // Only load retention squads if this isn't the first season of the league
                const rawSquads = (targetYear && targetYear !== firstYear)
                    ? retHelpers.getPrevSquads(targetYear)
                    : null;
                const annotatedSquads = rawSquads ? await annotateSquads(rawSquads, retHelpers.isUncappedFn, targetLeague) : null;
                // ─────────────────────────────────────────────────────────────────

                // Fetch players from correct league pools
                const players = await fetchAllPlayers(targetLeague);
                const playerIds = players.map(p => p._id);

                // Fetch all franchises from correct database or hardcoded fallback
                const normalizedFranchises = await loadFranchises(targetLeague);

                const defaultTeamCount = targetLeague === 'sa20' ? 6 : (targetLeague === 'wpl' ? 5 : 15);

                // AI Mode Logic: Handled in claim_team now
                if (isAiMode) {
                    console.log("[AI-MODE] Room created, waiting for host to claim team before adding bots.");
                }

                const newRoom = new AuctionRoom({
                    roomId: roomCode,
                    type: effectiveRoomType,
                    hostSocketId: socket.id,
                    status: 'Lobby',
                    unsoldPlayers: playerIds,
                    franchisesInRoom: [], // Join bots later
                    availableTeams: normalizedFranchises,
                    currentPlayerIndex: 0,
                    hostUserId: userId,
                    hostName: playerName,
                    isAiMode: isAiMode,
                    league: targetLeague,
                    currency: targetCurrency,
                    auctionYear: targetYear,
                    allowSpectators: true,
                    maxSpectators: 10,
                    teamCount: defaultTeamCount
                });
                await newRoom.save();

                socket.join(roomCode);
                socket.roomCode = roomCode; // Required by SocketRegistry place_bid handler

                // Init high-performance memory state
                roomStates[roomCode] = {
                    roomCode,
                    roomType: effectiveRoomType,
                    isAiMode: isAiMode,
                    league: targetLeague,
                    currency: targetCurrency,
                    host: socket.id,
                    hostName: playerName,
                    hostUserId: userId,
                    status: 'Lobby',
                    players: players,
                    currentIndex: 0,
                    teams: [], // Handled via claim_team
                    spectators: [],
                    joinRequests: [],
                    availableTeams: normalizedFranchises,
                    coHostUserIds: [],
                    currentBid: { amount: 0, teamId: null, teamName: null },
                    timer: 0,
                    timerDuration: 10,
                    isReAuctionRound: false,
                    unsoldHistory: [],
                    allowSpectators: true,
                    maxSpectators: 10,
                    teamCount: defaultTeamCount,
                    auctionYear: targetYear,
                    sa20Season: targetLeague === 'sa20' ? targetYear : null, // backward compat
                    retentionSquads: annotatedSquads, // annotated: [{name, isUncapped}] per team
                    retentionsByTeam: {},   // Tracks which team has submitted retentions
                };

                socket.emit('room_created', { roomCode, state: roomStates[roomCode] });

                // Notify host of retention squads for all leagues
                if (annotatedSquads) {
                    socket.emit('retention_squads_loaded', { squads: annotatedSquads, auctionYear: targetYear, league: targetLeague });
                }

                // Send available teams + presigned metadata to the creator
                socket.emit('available_teams', {
                    teams: roomStates[roomCode].availableTeams,
                    presignedByTeam: getPresignedByTeam(roomStates[roomCode])
                });

                // If this is a public room, broadcast it to the lobby menu globally
                if (roomType === 'public') {
                    broadcastPublicRooms();
                }
            } catch (error) {
                console.error('[ROOM_CREATE] Critical failure creating room:', error);
                socket.emit('error', `Failed to create room: ${error.message}`);
            }
        });

        // Join Room
        socket.on('join_room', async ({ roomCode, asSpectator = false }) => {
            // playerName and userId come from the verified JWT on the socket
            const userId = socket.userId;
            const playerName = socket.playerName;

            console.log(`[SESSION] join_room: roomCode=${roomCode}, userId=${userId}, playerName=${playerName}`);
            try {
                let state = roomStates[roomCode];
                if (!state) {
                    // Try to re-hydrate from DB
                    state = await rehydrateRoomState(roomCode);
                }

                if (!state) {
                    return socket.emit('error', 'Room not found or not active');
                }

                // Match ONLY by userId (secure). No playerName fallback to avoid identity hijacking.
                const existingTeam = userId ? state.teams.find(t => t.ownerUserId === userId) : null;
                const existingSpectator = userId ? state.spectators?.find(s => s.userId === userId) : null;

                // Occupancy Calculation: Get active sockets early for all checks
                const roomSockets = io.sockets.adapter.rooms.get(roomCode);
                const activeSids = roomSockets ? [...roomSockets] : [];
                const totalParticipants = activeSids.length;

                // RELAXED JOINING FOR RE-ENTRY:
                // If the user already owned a team, always allow them back in.
                const isApproved = (userId && state.approvedUserIds?.includes(userId)) || state.approvedSpectators?.includes(socket.id);
                if (state.status !== 'Lobby' && !existingTeam && !isApproved) {
                    if (asSpectator) {
                        return socket.emit('error', 'SPECTATOR_APPROVAL_REQUIRED');
                    } else {
                        return socket.emit('error', 'PLAYER_JOIN_DISABLED');
                    }
                }

                console.log(`[JOIN_ATTEMPT] Room:${roomCode} User:${playerName} asSpec:${asSpectator} TotalInRoom:${totalParticipants}`);

                if (!existingTeam && totalParticipants >= 30) {
                    return socket.emit('error', 'Room is currently full (Max 30 participants)');
                }

                // Spectator Limits & Automatic Assignment Detection
                // Count people who are ALREADY identified as spectators
                const currentSpecsCount = (state.spectators || []).length;
                // Count people who are ALREADY identified as players (owners or potential players in lobby)
                const alreadyIngameSids = state.teams.map(t => t.ownerSocketId).filter(Boolean);
                // Potential players are those in the room who aren't spectators and aren't existing owners
                const lobbyPlayersCount = activeSids.filter(sid =>
                    !state.spectators?.some(s => s.socketId === sid) &&
                    !alreadyIngameSids.includes(sid)
                ).length;

                const occupiedPlayerSlots = state.teams.length + lobbyPlayersCount;
                const maxPlayerSlots = state.teamCount || 15;

                console.log(`[JOIN_CALC] OccupiedSlots:${occupiedPlayerSlots}/${maxPlayerSlots} CurrentSpecs:${currentSpecsCount}/${state.maxSpectators || 10}`);

                // Force to spectator if player slots are full OR they were already a spectator
                const mustBeSpectator = asSpectator || existingSpectator || (!existingTeam && occupiedPlayerSlots >= maxPlayerSlots);

                if (mustBeSpectator && !existingTeam && !existingSpectator) {
                    const allowSpecs = state.allowSpectators !== false;
                    if (!allowSpecs) {
                        return socket.emit('error', 'Spectators are disabled for this room due to host restrictions.');
                    }
                    
                    const maxSpecs = state.maxSpectators || 10;
                    if (currentSpecsCount >= maxSpecs) {
                        return socket.emit('error', `Spectator limit reached (Max ${maxSpecs}). No slots available to join.`);
                    }
                }

                // Duplicate name search across all roles
                if (!existingTeam && playerName) {
                    const nameLower = playerName.toLowerCase().trim();
                    const isNameTakenByTeam = state.teams.some(t => t.ownerName?.toLowerCase().trim() === nameLower);
                    const isNameTakenBySpectator = state.spectators?.some(s => s.name?.toLowerCase().trim() === nameLower);
                    // Also check host name
                    const isNameTakenByHost = state.hostName?.toLowerCase().trim() === nameLower;

                    if (isNameTakenByTeam || isNameTakenBySpectator || isNameTakenByHost) {
                        return socket.emit('name_taken', {
                            message: `"${playerName}" is already taken in this room. Please use a different name.`
                        });
                    }
                }

                socket.join(roomCode);
                socket.roomCode = roomCode; // Required by SocketRegistry place_bid handler

                // Session Persistence: Re-link socket to their existing team via userId
                if (existingTeam) {
                    console.log(`[SESSION] Re-linking ${playerName} (userId: ${userId}) to team ${existingTeam.teamName} (New Socket: ${socket.id})`);
                    existingTeam.ownerSocketId = socket.id;

                    // Update host socket ID if this person is the host or a co-host
                    if (state.hostUserId === userId) {
                        state.host = socket.id;
                        console.log(`[SESSION] Re-linking host: ${playerName} (${userId})`);
                    } else if (state.coHostUserIds?.includes(userId)) {
                        console.log(`[SESSION] Re-linking co-host: ${playerName} (${userId})`);
                    }

                    io.to(roomCode).emit('lobby_update', { teams: lightweightTeams(state.teams, state.league) });
                }

                // Add to spectators list if required
                if (!existingTeam && mustBeSpectator) {
                    if (!state.spectators) state.spectators = [];
                    const existingSpectator = state.spectators.find(s => (userId && s.userId === userId) || s.socketId === socket.id);
                    if (existingSpectator) {
                        existingSpectator.socketId = socket.id;
                    } else {
                        state.spectators.push({ socketId: socket.id, userId, name: playerName });
                    }
                }

                // Build a lightweight state summary for room_joined
                const isActivePhase = state.status === 'Lobby' || state.status === 'Auctioning' || state.status === 'Paused';
                const hasPlayers = Array.isArray(state.players) && state.players.length > 0;
                const stateSummary = {
                    ...state,
                    players: hasPlayers ? state.players.map(p => ({ _id: p._id, name: p.name, player: p.player, poolName: p.poolName, basePrice: p.basePrice, imagepath: p.imagepath, image_path: p.image_path, photoUrl: p.photoUrl })) : [],
                    teams: isActivePhase ? lightweightTeams(state.teams, state.league) : state.teams,
                    activePlayer: (hasPlayers && (state.status === 'Auctioning' || state.status === 'Paused')) ? state.players[state.currentIndex] : null,
                    activeBid: state.currentBid,
                    unsoldHistory: state.unsoldHistory || []
                };

                socket.emit('room_joined', { roomCode, state: stateSummary });
                io.to(roomCode).emit('spectator_update', { spectators: state.spectators || [] });

                // Send available teams (with presigned metadata) to this joiner
                if (state.status === 'Lobby') {
                    socket.emit('available_teams', { teams: state.availableTeams, presignedByTeam: getPresignedByTeam(state) });
                }

                // Re-send retention squad for reconnecting team owners
                if (state.retentionSquads && existingTeam && state.status === 'Lobby') {
                    const squadData = findTeamRetentionSquad(state, existingTeam.teamName);
                    if (squadData) {
                        socket.emit('my_team_retention_squad', { squad: squadData, auctionYear: state.auctionYear, league: state.league });
                        // If they already submitted retentions, confirm it
                        const alreadySubmitted = state.retentionsByTeam && Object.prototype.hasOwnProperty.call(state.retentionsByTeam, existingTeam.teamName);
                        if (alreadySubmitted) {
                            const savedRetentions = state.retentionsByTeam[existingTeam.teamName];
                            const savedCustomPrices = state.customPricesByTeam?.[existingTeam.teamName] || {};
                            socket.emit('retentions_already_submitted', { retainedPlayers: savedRetentions, customPrices: savedCustomPrices });
                        }
                    }
                }

                // If the auction is live and this is a returning team owner or spectator,
                // push follow-up details (like next players) immediately.
                if (state.status === 'Auctioning' || state.status === 'Paused') {
                    const currentPlayer = state.players[state.currentIndex];
                    const nextPlayers = state.players.slice(state.currentIndex + 1);
                    if (currentPlayer) {
                        console.log(`[SESSION] Pushing supplemental sync for "${currentPlayer.name || currentPlayer.player}" to socket ${socket.id}`);
                        socket.emit('new_player', {
                            player: currentPlayer,
                            nextPlayers: nextPlayers.slice(0, 10),
                            timer: state.timer
                        });
                        if (state.currentBid && state.currentBid.amount > 0) {
                            socket.emit('bid_placed', { currentBid: state.currentBid, timer: state.timer });
                        }
                    }
                }

                // Sync quiz phase for reconnecting clients
                if (state.status === 'Quiz' && state.quiz?.active) {
                    socket.emit('quiz_phase_started', {
                        roomCode,
                        league: state.league || 'ipl',
                        totalQuestions: state.quiz.questions?.length || 10,
                    });
                    const idx = state.quiz.currentQuestionIndex;
                    if (idx >= 0 && state.quiz.questions[idx]) {
                        const q = state.quiz.questions[idx];
                        socket.emit('quiz_question', getSafeQuizQuestion(q, idx, state.quiz.questions.length, 12));
                    }
                    socket.emit('quiz_leaderboard_update', { leaderboard: buildQuizLeaderboard(state.quiz.scores) });
                }

                if (state.status === 'Evaluating') {
                    const remaining = Math.max(0, Math.ceil((state.evaluationTimerEndsAt - Date.now()) / 1000));
                    socket.emit('evaluation_started', { timer: remaining || 90 });
                }

                // Broadcast current online map (team owners + spectators) using stable userId
                const onlineMap = {};
                state.teams?.forEach(t => {
                    if (t.ownerUserId) onlineMap[t.ownerUserId] = true;
                });
                state.spectators?.forEach(s => {
                    if (s.userId) onlineMap[s.userId] = true;
                });
                io.to(roomCode).emit('player_status_update', { onlineMap });

                // Add lazy-load roster request handler
                socket.on('request_team_roster', ({ teamId }) => {
                    const roomState = roomStates[roomCode];
                    if (!roomState) return;
                    const team = roomState.teams.find(t => t.id === teamId || t.franchiseId === teamId);
                    if (team) {
                        socket.emit('team_roster_data', {
                            teamId,
                            playersAcquired: team.playersAcquired || []
                        });
                    }
                });
            } catch (error) {
                console.error(error);
                socket.emit('error', 'Failed to join room');
            }
        });

        // --- Voice Chat Signaling ---
        socket.on('voice-join', ({ roomCode }) => {
            console.log(`[VOICE] User ${socket.id} joining voice in room ${roomCode}`);
            // Notify others in the room that a new voice participant has arrived
            socket.to(roomCode).emit('voice-user-joined', { socketId: socket.id, userId: socket.userId });
        });

        socket.on('voice-signal', ({ to, signal }) => {
            // Forward signaling data to the target peer
            io.to(to).emit('voice-signal', { from: socket.id, signal });
        });

        socket.on('voice-leave', ({ roomCode }) => {
            console.log(`[VOICE] User ${socket.id} leaving voice in room ${roomCode}`);
            socket.to(roomCode).emit('voice-user-left', { socketId: socket.id });
        });

        // Claim Team (Called by players from the Lobby UI)
        socket.on('claim_team', async ({ roomCode, teamId }) => {
            const userId = socket.userId;
            const playerName = socket.playerName;

            try {
                if (!roomCode) return socket.emit('error', 'Room code is required');

                const state = roomStates[roomCode];
                if (!state) return socket.emit('error', 'Room not found or not active');
                const isApproved = (userId && state.approvedUserIds?.includes(userId)) || state.approvedSpectators?.includes(socket.id);
                if (state.status !== 'Lobby' && !isApproved) {
                    return socket.emit('error', 'You must be approved by the host to join an active auction.');
                }

                const teamLimit = state.teamCount || 15;
                if (state.teams.length >= teamLimit) {
                    return socket.emit('error', `Room is full. Max franchises allowed: ${teamLimit}`);
                }

                // Check if user already claimed a team (by userId for secure check)
                const alreadyOwns = userId
                    ? state.teams.some(t => t.ownerUserId === userId)
                    : state.teams.some(t => t.ownerSocketId === socket.id);
                if (alreadyOwns) {
                    return socket.emit('error', 'You have already secured a franchise');
                }

                const teamIndex = state.availableTeams.findIndex(t => t.shortName === teamId);
                if (teamIndex === -1) return socket.emit('error', 'That franchise is already secured by another owner!');

                // Legacy Team Restriction: If teamCount <= 10, ignore legacy teams
                const legacyIds = ['DCG', 'KTK', 'PWI', 'RPS', 'GL'];
                if (teamLimit <= 10 && legacyIds.includes(teamId)) {
                    return socket.emit('error', 'Legacy franchises are disabled for rooms of 10 or fewer players.');
                }

                const assignedTeamDef = state.availableTeams.splice(teamIndex, 1)[0];

                const newTeamObj = {
                    franchiseId: assignedTeamDef._id,
                    teamName: assignedTeamDef.name,
                    teamThemeColor: assignedTeamDef.primaryColor,
                    teamLogo: assignedTeamDef.logoUrl,
                    ownerSocketId: socket.id,
                    ownerUserId: userId,     // Permanent secure identifier
                    ownerName: playerName,   // Display name (can be duplicated, not used for auth)
                    currentPurse: assignedTeamDef.purseLimit,
                    startingPurse: assignedTeamDef.purseLimit,
                    overseasCount: 0,
                    rtmUsed: false,
                    rtmCards: getTeamRtmCards(state, assignedTeamDef.name),
                    rtmUsedCount: 0,
                    playersAcquired: []
                };

                state.teams.push(newTeamObj);

                // Remove from spectators if they were one
                if (state.spectators) {
                    state.spectators = state.spectators.filter(s => s.socketId !== socket.id);
                }
                if (state.joinRequests) {
                    state.joinRequests = state.joinRequests.filter(r => r.socketId !== socket.id);
                    io.to(state.host).emit('join_requests_update', { requests: state.joinRequests });
                }

                // Broadcast updated list to everyone in lobby
                io.to(roomCode).emit('lobby_update', { teams: lightweightTeams(state.teams, state.league) });
                io.to(roomCode).emit('spectator_update', { spectators: state.spectators || [] });
                io.to(roomCode).emit('available_teams', { teams: state.availableTeams, presignedByTeam: getPresignedByTeam(state) });

                // Acknowledge directly to the claiming user so they can stop their loading spinner
                socket.emit('team_claimed_success');

                // Send retention squad for this team (if retentions are enabled for this room)
                if (state.retentionSquads) {
                    const squadData = findTeamRetentionSquad(state, newTeamObj.teamName);
                    if (squadData) {
                        socket.emit('my_team_retention_squad', { squad: squadData, auctionYear: state.auctionYear, league: state.league });
                    }
                }

                // Update authoritative DB state asynchronously (batched)
                // Broadcast joining event (using markDirty for periodic flush)
                markDirty(roomCode, { franchisesInRoom: state.teams });
                io.to(roomCode).emit('lobby_update', { teams: lightweightTeams(state.teams, state.league) });
                if (state.roomType === 'public') {
                    broadcastPublicRooms();
                }

                // AI Mode: If the host claimed a team, fill the rest with bots
                if (state.isAiMode && state.teams.length === 1) {
                    await fillRoomWithBots(roomCode, io);
                }

            } catch (error) {
                console.error(error);
                socket.emit('error', 'Failed to assign team');
            }
        });

        // ── Retention: Each team owner submits their chosen retained players ──────
        // Works for ALL leagues: IPL (max 5 capped + 1 uncapped),
        //                        WPL (max 4 capped + 1 uncapped),
        //                        SA20 (max 4 capped + 1 uncapped)
        socket.on('submit_retentions', ({ roomCode, retainedPlayers, customPrices }) => {
            const state = roomStates[roomCode];
            if (!state) return socket.emit('error', 'Room not found');
            if (state.status !== 'Lobby') return socket.emit('error', 'Retentions can only be submitted in the lobby');
            if (!state.retentionSquads) {
                return socket.emit('error', 'No retention data available for this room');
            }

            // Find the team owned by this socket
            const team = state.teams.find(t =>
                (socket.userId && t.ownerUserId === socket.userId) || t.ownerSocketId === socket.id
            );
            if (!team) return socket.emit('error', 'You do not own a team in this room');

            const selected = (retainedPlayers || []).map(String);

            // Route validation to the correct league history service
            const helpers = getRetentionHelpers(state.league);
            const validation = helpers.validateFn(team.teamName, state.auctionYear, selected);
            if (!validation.valid) {
                return socket.emit('error', `Retention error: ${validation.error}`);
            }

            // Check overseas count (max 2 overseas players can be retained)
            const squadData = findTeamRetentionSquad(state, team.teamName);
            if (squadData) {
                const selectedOverseas = selected.filter(name => {
                    const playerObj = squadData.find(p => p.name === name);
                    return playerObj?.isOverseas;
                });
                if (selectedOverseas.length > 2) {
                    return socket.emit('error', `Retention error: Maximum 2 overseas players can be retained. Selected: ${selectedOverseas.join(', ')}`);
                }
            }

            // Store retentions against this team (keyed by game team name)
            if (!state.retentionsByTeam) state.retentionsByTeam = {};
            state.retentionsByTeam[team.teamName] = selected;
            team.rtmCards = getTeamRtmCards(state, team.teamName);
            team.rtmUsedCount = team.rtmUsedCount || 0;

            // Build cost breakdown for the UI confirmation
            const cappedSelected   = selected.filter(n => !helpers.isUncappedFn(n));
            const uncappedSelected = selected.filter(n =>  helpers.isUncappedFn(n));
            const { breakdown } = helpers.calculateFn(cappedSelected, uncappedSelected[0] || null);

            // Compute actual total cost using custom prices if provided
            let totalCost = 0;
            const validatedCustomPrices = {};
            breakdown.forEach(({ name: pName, cost: defaultCost }) => {
                const customCost = customPrices?.[pName];
                const cost = (customCost !== undefined && customCost !== null && !isNaN(customCost) && customCost >= 0)
                    ? Number(customCost)
                    : defaultCost;
                validatedCustomPrices[pName] = cost;
                totalCost += cost;
            });

            // Validate total cost for maximum players
            const maxCapped = state.league === 'wpl' ? 3 : 4;
            const maxUncapped = 1;
            const maxTotal = maxCapped + maxUncapped;

            if (selected.length === maxTotal) {
                const requiredTotal = state.league === 'wpl' ? 900 : 250; // WPL: 9Cr = 900 units, SA20: 25M = 250 units
                if (totalCost !== requiredTotal) {
                    const label = state.league === 'wpl' ? '₹9.00 Cr' : 'R 25.0M';
                    return socket.emit('error', `Retention error: When retaining the maximum of ${maxTotal} players, the total spent must be exactly ${label}. Currently: ${totalCost}`);
                }
            }

            // Verify total cost doesn't exceed starting purse limit
            const startingPurse = team.startingPurse || (state.league === 'sa20' ? 410 : (state.league === 'wpl' ? 1500 : 12000));
            if (totalCost > startingPurse) {
                return socket.emit('error', `Retention error: Total retention cost (${totalCost} units) exceeds team purse limit (${startingPurse} units)`);
            }

            // Store validated custom prices
            if (!state.customPricesByTeam) state.customPricesByTeam = {};
            state.customPricesByTeam[team.teamName] = validatedCustomPrices;

            const retentionDetails = breakdown.map(r => ({
                name:       r.name,
                isUncapped: r.isUncapped,
                cost:       validatedCustomPrices[r.name],
                slot:       r.slot
            }));

            // Confirm to the submitter
            socket.emit('retentions_confirmed', { teamName: team.teamName, retentionDetails, totalCost });

            // Broadcast retention status to everyone in the lobby (host can track progress)
            const retentionStatus = {};
            state.teams.forEach(t => {
                retentionStatus[t.teamName] = Object.prototype.hasOwnProperty.call(state.retentionsByTeam, t.teamName)
                    ? state.retentionsByTeam[t.teamName]
                    : null;
            });
            io.to(roomCode).emit('lobby_retention_update', { 
                retentionStatus,
                customPricesByTeam: state.customPricesByTeam
            });
            io.to(roomCode).emit('lobby_update', { teams: lightweightTeams(state.teams, state.league) });

            const league = state.league.toUpperCase();
            console.log(`[${league}-RETAIN] ${team.teamName} in room ${roomCode} retained: ${selected.join(', ') || 'none'}`);
        });

        // Start Auction
        socket.on('start_auction', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state) return;
            if (!isModerator(state, socket.id, socket.userId)) return socket.emit('error', 'Only host or co-host can start');

            // Prevent starting auction when nobody has claimed a franchise
            if (!state.teams || state.teams.length === 0) {
                return socket.emit('error', 'At least one team must claim a franchise before auction can begin');
            }

            // ── All-league retention: Apply retained players before starting ───────
            // IPL: max 5 capped + 1 uncapped  |  WPL: max 4+1  |  SA20: max 4+1
            if (state.retentionSquads && state.retentionsByTeam) {
                const helpers = getRetentionHelpers(state.league);
                const retainedNames = new Set();
                const leagueTag = state.league.toUpperCase();

                state.teams.forEach(team => {
                    const selected = state.retentionsByTeam[team.teamName] || [];
                    if (!selected.length) return;

                    // Separate capped and uncapped retentions
                    const cappedRetains   = selected.filter(n => !helpers.isUncappedFn(n));
                    const uncappedRetains = selected.filter(n =>  helpers.isUncappedFn(n));

                    const squadData = findTeamRetentionSquad(state, team.teamName);

                    // Slot-based billing via league helper
                    const { breakdown } = helpers.calculateFn(cappedRetains, uncappedRetains[0] || null);

                    const teamCustomPrices = state.customPricesByTeam?.[team.teamName] || {};
                    breakdown.forEach(({ name: pName, cost: defaultCost, isUncapped: uncapped }) => {
                        const customCost = teamCustomPrices[pName];
                        const cost = (customCost !== undefined && customCost !== null) ? customCost : defaultCost;
                        const playerObj = squadData?.find(p => p.name === pName);
                        const isOverseas = !!playerObj?.isOverseas;

                        team.playersAcquired.push({
                            player: null,       // No DB id — historical retention
                            name: pName,
                            role: 'Retained',
                            nationality: isOverseas ? 'International' : 'Domestic',
                            isOverseas: isOverseas,
                            boughtFor: cost,
                            isRetained: true,
                            isUncapped: uncapped
                        });
                        if (isOverseas) {
                            team.overseasCount = (team.overseasCount || 0) + 1;
                        }
                        team.currentPurse = Math.max(0, (team.currentPurse || 0) - cost);
                        retainedNames.add(pName);
                    });

                    const totalCost = breakdown.reduce((s, p) => {
                        const customCost = teamCustomPrices[p.name];
                        const cost = (customCost !== undefined && customCost !== null) ? customCost : p.cost;
                        return s + cost;
                    }, 0);
                    console.log(`[${leagueTag}-RETAIN] ${team.teamName}: retained ${breakdown.length} player(s), cost ${totalCost}. Purse: ${team.currentPurse}`);
                });

                // Remove retained players from the live auction pool (name-based)
                if (retainedNames.size > 0) {
                    const before = state.players.length;
                    const canonicalRetained = new Set(
                        [...retainedNames].map(name => canonicalizePlayerName(name))
                    );
                    state.players = state.players.filter(p => {
                        const pName = p.player || p.name || '';
                        return !canonicalRetained.has(canonicalizePlayerName(pName));
                    });
                    console.log(`[${leagueTag}-RETAIN] Removed ${before - state.players.length} retained players from auction pool.`);
                }
            }
            // ─────────────────────────────────────────────────────────────────────

            // Initialize RTM cards counts for each team
            state.teams.forEach(team => ensureTeamRtmFields(state, team));

            state.status = 'Auctioning';
            io.to(roomCode).emit('auction_started', { state });

            // Mark status as dirty — will flush in next 30s window
            markDirty(roomCode, { status: 'Auctioning', franchisesInRoom: state.teams });

            // Update ActiveRoom in mongo
            ActiveRoom.updateOne(
                { roomCode },
                { $set: { auctionStatus: 'ONGOING', teams: state.teams } }
            ).exec().catch(err => console.warn(`[START] ActiveRoom update failed:`, err.message));

            // Room has started, remove it from the public lobbies list
            if (state.roomType === 'public') {
                broadcastPublicRooms();
            }

            // Load first player after a slight delay
            setTimeout(() => loadNextPlayer(roomCode, io), 800);
        });

        // Place Bid
        socket.on('place_bid', ({ roomCode, amount }) => {
            const state = roomStates[roomCode];
            // Bug 1 fix: accept both 'Auctioning' (set by start_auction) and
            // 'ONGOING' (set by loadNextPlayer) — these are equivalent active states.
            if (!state || (state.status !== 'Auctioning' && state.status !== 'ONGOING')) return;

            // Verify team using userId
            const team = state.teams.find(t => t.ownerUserId === socket.userId);
            if (!team) return socket.emit('error', 'You are not assigned to a franchise');
            if (state.currentBid.teamId === team.franchiseId) return socket.emit('error', 'You already hold the highest bid');

            // Determine Increment
            const currentPlayer = state.currentPlayer || {};
            const curAmt = state.currentBid.amount || 0;
            const poolID = currentPlayer.poolID || '';
            const basePrice = currentPlayer.basePrice || 20;
            const requiredBid = getRequiredBid(curAmt, basePrice, poolID, state.league);
            const bidAmount = snapBidForLeague(amount, state.league);
            // Use raw milliseconds for validation to avoid rounding issues in the last second.
            const remainingMs = state.timerEndsAt ? (state.timerEndsAt - Date.now()) : (state.timer * 1000);

            // 1. Strict Validation
            // Allow bids until 1000ms after timer expiry (matching the -1s grace period in tickAuctionTimer)
            if (remainingMs < -1000) return socket.emit('error', 'Auction for this player has ended.');
            if (amount < requiredBid) return socket.emit('error', `Minimum bid is ${requiredBid}L`);
            if (bidAmount < requiredBid) return socket.emit('error', `Minimum bid is ${requiredBid}L`);
            if (amount > team.currentPurse) return socket.emit('error', 'Insufficient purse limit');
            const maxSquad = state.league === 'wpl' ? 18 : (state.league === 'sa20' ? 19 : 25);
            const maxOverseas = state.league === 'wpl' ? 6 : (state.league === 'sa20' ? 7 : 8);
            if (team.playersAcquired.length >= maxSquad) return socket.emit('error', `Squad limit reached (Max ${maxSquad})`);

            // 1.1 Overseas Limit Check
            const overseasCount = (team.playersAcquired || []).filter(p => p.isOverseas || p.overseas).length;
            const playerIsOverseas = currentPlayer.isOverseas || currentPlayer.overseas;
            if (playerIsOverseas && overseasCount >= maxOverseas) {
                return socket.emit('error', `Overseas player limit reached (Max ${maxOverseas})`);
            }

            // 2. IN-MEMORY STATE MUTATION (synchronous, race-safe via Node.js single thread)
            const now = new Date();
            state.currentBid = { 
                amount: bidAmount, 
                teamId: team.franchiseId, 
                teamName: team.teamName, 
                teamColor: team.teamThemeColor, 
                teamLogo: team.teamLogo, 
                ownerName: team.ownerName 
            };
            state.lastBidTime = now;
            state.timer = state.timerDuration;
            // Reset the timerEndsAt so timer check stays correct after this bid
            state.timerEndsAt = Date.now() + (state.timerDuration * 1000);

            // Track bid history in memory
            if (!state.last5Bids) state.last5Bids = [];
            state.last5Bids = [...state.last5Bids, { amount: bidAmount, teamName: team.teamName, timestamp: now }].slice(-5);

            // 3. Broadcast to all clients immediately
            emitFullAuctionState(roomCode, io);

            // 4. Fire-and-forget DB persist (upsert so it works even if no ActiveRoom doc exists)
            ActiveRoom.findOneAndUpdate(
                { roomCode },
                {
                    $set: {
                        currentBid: { amount: bidAmount, teamId: team.franchiseId, teamName: team.teamName, ownerUserId: team.ownerUserId },
                        lastBidTime: now,
                        auctionStatus: 'ONGOING'
                    },
                    $push: {
                        last5Bids: {
                            $each: [{ amount: bidAmount, teamName: team.teamName, timestamp: now }],
                            $slice: -5
                        }
                    }
                },
                { upsert: true, returnDocument: 'before' }
            ).catch(err => console.warn(`[BID] DB persist failed for ${roomCode}:`, err.message));
        });

        // RTM Decision
        socket.on('rtm_decision', async ({ roomCode, useRtm }) => {
            const state = roomStates[roomCode];
            if (!state || state.status !== 'RTM' || !state.rtmState) return;

            // Security check: Only the franchise owner of the RTM team can decide
            if (state.rtmState.prevTeamOwnerUserId !== socket.userId) {
                return socket.emit('error', 'Only the previous franchise owner of this player can make the RTM decision.');
            }

            console.log(`[RTM-USER] User ${socket.userId} decided to ${useRtm ? 'USE' : 'PASS'} RTM for ${state.rtmState.playerName}`);
            await handleRtmDecision(roomCode, io, useRtm);
        });

        // Skip Player (AI Mode Only)
        socket.on('skip_player', async ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state || !state.isAiMode) return;
            if (state.status !== 'Auctioning' && state.status !== 'ONGOING') return;
            if (state.host !== socket.id) return;

            console.log(`[AI-MODE] Host triggered skip for player: ${state.players[state.currentIndex]?.name}`);
            await autoResolveCurrentPlayer(roomCode, io);
        });

        // Skip Pool (AI Mode Only)
        socket.on('skip_pool', async ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state || !state.isAiMode) return;
            if (state.status !== 'Auctioning' && state.status !== 'ONGOING') return;
            if (state.host !== socket.id) return;

            const currentPlayer = state.players[state.currentIndex];
            const currentPool = currentPlayer?.poolID;
            if (!currentPool) return;

            console.log(`[AI-MODE] Host triggered skip for pool: ${currentPool}`);

            // Resolve until pool changes or end reached
            // Note: autoResolve increments currentIndex and calls loadNextPlayer.
            // We'll use a while loop but be careful of infinite loops if state doesn't update.
            let safetyCounter = 0;
            while (
                safetyCounter < 200 && 
                state.currentIndex < state.players.length && 
                state.players[state.currentIndex]?.poolID === currentPool
            ) {
                await autoResolveCurrentPlayer(roomCode, io, 0); // No delay for bulk skips
                safetyCounter++;
            }
        });

        // --- CHAT SYSTEM ---
        socket.on('send_chat_message', ({ roomCode, message }) => {
            const state = roomStates[roomCode];
            if (!state) return;

            // Find who sent it
            const team = state.teams.find(t => t.ownerSocketId === socket.id);
            const senderName = team ? team.ownerName : 'Host';
            const senderTeam = team ? team.teamName : 'System';
            const senderColor = team ? team.teamThemeColor : '#ffffff';
            const senderLogo = team ? team.teamLogo : null;

            io.to(roomCode).emit('receive_chat_message', {
                id: Date.now() + Math.random(),
                senderName,
                senderTeam,
                senderColor,
                senderLogo,
                message,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        });

        // --- STATE SYNC ---
        socket.on('request_auction_sync', ({ roomCode }) => {
            const state = roomStates[roomCode];
            // Allow sync even if paused, just not in lobby, or finished
            if (!state || ['Lobby', 'Finished', 'Evaluating'].includes(state.status)) return;

            const player = state.players[state.currentIndex];
            const nextPlayers = state.players.slice(state.currentIndex + 1);

            if (player) {
                socket.emit('new_player', { player, nextPlayers, timer: state.timer });
                socket.emit('bid_placed', { currentBid: state.currentBid, timer: state.timer });
            }
        });

        // --- QUIZ HANDLER ---
        socket.on('submit_quiz_answer', ({ roomCode, quizIndex, answerIndex }) => {
            const state = roomStates[roomCode];
            if (!state || !state.quiz || !state.quiz.active) return;

            const q = state.quiz.questions.find(x => x.quizIndex === quizIndex);
            if (!q) return;
            if (state.quiz.currentQuestionIndex !== state.quiz.questions.findIndex(x => x.quizIndex === quizIndex)) return;

            const userId = socket.userId || socket.id;
            const userName = socket.playerName || 'Guest';

            if (!state.quiz.scores[userId]) {
                state.quiz.scores[userId] = { name: userName, score: 0, answered: [], responseTimes: [], correctCount: 0 };
            }

            const userScoreObj = state.quiz.scores[userId];
            if (userScoreObj.answered.includes(quizIndex)) return;

            const responseMs = Math.max(0, Date.now() - (state.quiz.questionStartedAt || Date.now()));
            userScoreObj.answered.push(quizIndex);
            userScoreObj.responseTimes.push({ quizIndex, ms: responseMs });

            if (!state.quiz.currentQuestionAnsweredBy) state.quiz.currentQuestionAnsweredBy = new Set();
            state.quiz.currentQuestionAnsweredBy.add(userId);

            if (q.correctIndex === answerIndex) {
                userScoreObj.score += q.points;
                userScoreObj.correctCount += 1;
                if (userScoreObj.score > 12 && !userScoreObj.bonusAwarded) {
                    userScoreObj.score += 1;
                    userScoreObj.bonusAwarded = true;
                }
                socket.emit('quiz_answer_result', { quizIndex, correct: true, pointsAdded: q.points, responseMs });
            } else {
                socket.emit('quiz_answer_result', { quizIndex, correct: false, pointsAdded: 0, correctIndex: q.correctIndex, responseMs });
            }

            io.to(roomCode).emit('quiz_leaderboard_update', { leaderboard: buildQuizLeaderboard(state.quiz.scores) });

            const expectedResponders = Math.max(1, new Set((state.teams || []).filter((team) => !team?.isBot).map((team) => team.ownerUserId || team.ownerSocketId).filter(Boolean)).size);
            if ((state.quiz.currentQuestionAnsweredBy?.size || 0) >= expectedResponders) {
                const currentQuestionIndex = state.quiz.currentQuestionIndex;
                const currentQuestion = state.quiz.questions[currentQuestionIndex];
                if (currentQuestion && !state.quiz.questionClosed) {
                    state.quiz.questionClosed = true;
                    if (state.quiz.questionTimerInterval) {
                        clearInterval(state.quiz.questionTimerInterval);
                        state.quiz.questionTimerInterval = null;
                    }
                    io.to(roomCode).emit('quiz_question_closed', {
                        quizIndex: currentQuestion.quizIndex,
                        correctIndex: currentQuestion.correctIndex,
                        correctAnswer: currentQuestion.options[currentQuestion.correctIndex],
                    });
                    if (typeof state.quiz.questionResolver === 'function') {
                        const resolve = state.quiz.questionResolver;
                        state.quiz.questionResolver = null;
                        resolve();
                    }
                }
            }
        });

        // --- SPECTATOR & HOST APPROVAL ---
        socket.on('request_participation', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state) return;

            const userId = socket.userId;
            const playerName = socket.playerName;

            // Check if user already owns a team
            const alreadyOwns = state.teams.some(t => t.ownerUserId === userId);
            if (alreadyOwns) return socket.emit('error', 'You are already a team owner.');

            if (!state.joinRequests) state.joinRequests = [];

            // Prevent duplicate requests by userId
            if (!state.joinRequests.some(r => r.userId === userId)) {
                state.joinRequests.push({
                    socketId: socket.id,
                    userId,
                    name: playerName,
                    time: Date.now()
                });
                io.to(state.host).emit('join_requests_update', { roomCode, requests: state.joinRequests });
            }
        });

        socket.on('approve_participation', ({ roomCode, targetUserId, targetSocketId }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod) return;

            if (!state.joinRequests) state.joinRequests = [];

            // Find by userId (preferred) or targetSocketId
            const requestIndex = state.joinRequests.findIndex(r =>
                (targetUserId && r.userId === targetUserId) || r.socketId === targetSocketId
            );

            if (requestIndex !== -1) {
                const request = state.joinRequests.splice(requestIndex, 1)[0];
                const actualSocketId = request.socketId;

                if (!state.approvedSpectators) state.approvedSpectators = [];
                // Store both for fallback
                state.approvedSpectators.push(actualSocketId);
                if (request.userId) {
                    if (!state.approvedUserIds) state.approvedUserIds = [];
                    state.approvedUserIds.push(request.userId);
                }

                io.to(actualSocketId).emit('participation_approved');
                io.to(state.host).emit('join_requests_update', { roomCode, requests: state.joinRequests });
            }
        });

        socket.on('reject_participation', ({ roomCode, targetUserId, targetSocketId }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod) return;

            if (!state.joinRequests) state.joinRequests = [];
            const requestIndex = state.joinRequests.findIndex(r =>
                (targetUserId && r.userId === targetUserId) || r.socketId === targetSocketId
            );

            if (requestIndex !== -1) {
                const request = state.joinRequests.splice(requestIndex, 1)[0];
                io.to(request.socketId).emit('participation_rejected');
                io.to(state.host).emit('join_requests_update', { roomCode, requests: state.joinRequests });
            }
        });

        // --- HOST MODERATION & PLAYER EXITS ---

        // Player voluntarily leaving
        socket.on('leave_room', async ({ roomCode, playerName }) => {
            const state = roomStates[roomCode];
            if (!state) return;

            const userId = socket.userId;

            // If the Host leaves during the Lobby phase, disband the room
            const mod = isModerator(state, socket.id, socket.userId);
            if (mod && state.status === 'Lobby') {
                delete roomStates[roomCode];
                io.to(roomCode).emit('room_disbanded');
                io.in(roomCode).socketsLeave(roomCode);
                AuctionRoom.findOneAndDelete({ roomId: roomCode }).exec();
                broadcastPublicRooms();
                return;
            }

            // If the Host leaves during an active Auction, promote a new host
            if (mod && state.status !== 'Lobby') {
                promoteNewHost(roomCode, io);
            }

            // Normal player leaving - find by userId first
            const teamIndex = state.teams.findIndex(t =>
                (userId && t.ownerUserId === userId) || t.ownerSocketId === socket.id
            );
            if (teamIndex !== -1) {
                const removedTeam = state.teams.splice(teamIndex, 1)[0];

                // Return team to available pool
                state.availableTeams.push({
                    _id: removedTeam.franchiseId,
                    name: removedTeam.teamName,
                    primaryColor: removedTeam.teamThemeColor,
                    logoUrl: removedTeam.teamLogo,
                    purseLimit: removedTeam.currentPurse,
                    shortName: removedTeam.teamName.split(' ').map(w => w[0]).join('')
                });

                AuctionRoom.findOneAndUpdate({ roomId: roomCode }, { $pull: { franchisesInRoom: { ownerSocketId: socket.id } } }).exec();
            }

            // Remove from spectators if applicable
            if (state.spectators) {
                state.spectators = state.spectators.filter(s => s.socketId !== socket.id);
                io.to(roomCode).emit('spectator_update', { spectators: state.spectators });
            }
            if (state.joinRequests) {
                const initialLen = state.joinRequests.length;
                state.joinRequests = state.joinRequests.filter(r => r.socketId !== socket.id);
                if (state.joinRequests.length !== initialLen) {
                    io.to(state.host).emit('join_requests_update', { roomCode, requests: state.joinRequests });
                }
            }

            socket.leave(roomCode);
            io.to(roomCode).emit('lobby_update', { teams: lightweightTeams(state.teams, state.league) });
            io.to(roomCode).emit('available_teams', { teams: state.availableTeams, presignedByTeam: getPresignedByTeam(state) });
            broadcastPublicRooms();
        });

        // Kick Player
        socket.on('kick_player', async ({ roomCode, targetSocketId, targetUserId }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod) {
                return socket.emit('error', 'Unauthorized: Only the host/co-host can kick players.');
            }

            // Prevent host from kicking themselves
            if ((targetUserId && socket.userId === targetUserId) || (!targetUserId && socket.id === targetSocketId)) {
                return socket.emit('error', 'You cannot kick yourself');
            }

            // Find if the target has claimed a team
            let teamIndex = -1;
            if (targetUserId) {
                teamIndex = state.teams.findIndex(t => t.ownerUserId === targetUserId);
            } else {
                teamIndex = state.teams.findIndex(t => t.ownerSocketId === targetSocketId);
            }


            if (teamIndex !== -1) {
                const removedTeam = state.teams.splice(teamIndex, 1)[0];

                // Construct a franchise-like object to place back into availableTeams
                state.availableTeams.push({
                    _id: removedTeam.franchiseId,
                    name: removedTeam.teamName,
                    primaryColor: removedTeam.teamThemeColor,
                    logoUrl: removedTeam.teamLogo,
                    purseLimit: removedTeam.currentPurse + removedTeam.playersAcquired.reduce((sum, p) => sum + p.boughtFor, 0), // Restore full purse
                    shortName: removedTeam.teamName.split(' ').map(w => w[0]).join('') // Approx shortName
                });

                // Update Authoritative DB
                if (targetUserId) {
                    AuctionRoom.findOneAndUpdate({ roomId: roomCode }, { $pull: { franchisesInRoom: { ownerUserId: targetUserId } } }).exec();
                } else {
                    AuctionRoom.findOneAndUpdate({ roomId: roomCode }, { $pull: { franchisesInRoom: { ownerSocketId: targetSocketId } } }).exec();
                }


                // If it's a public room, the player count just dropped, so inform the lobby
                if (state.roomType === 'public') {
                    broadcastPublicRooms();
                }
            }

            // Tell target they were kicked
            io.to(targetSocketId).emit('kicked_from_room');

            // Disconnect the socket violently from the room cleanly
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) targetSocket.leave(roomCode);

            // Notify everyone else
            io.to(roomCode).emit('lobby_update', { teams: lightweightTeams(state.teams, state.league) });
            io.to(roomCode).emit('available_teams', { teams: state.availableTeams, presignedByTeam: getPresignedByTeam(state) });
        });

        // Pause / Resume
        socket.on('pause_auction', ({ roomCode }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod) return socket.emit('error', 'Unauthorized: Only moderators can pause the auction.');
            state.status = 'Paused';
            // Stop the interval timer temporarily
            if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);
            io.to(roomCode).emit('auction_paused', { state });
        });

        socket.on('resume_auction', ({ roomCode }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod || state.status !== 'Paused') return socket.emit('error', 'Unauthorized: Only moderators can resume the auction.');

            if (state.votingSession && state.votingSession.active) {
                return socket.emit('error', 'Cannot resume auction while voting is in progress.');
            }
            state.status = 'Auctioning';

            // Re-sync timer Ends At based on how much time was remaining
            if (state.timer > 0 && state.currentIndex < state.players.length) {
                state.timerEndsAt = Date.now() + (state.timer * 1000);
                // CRITICAL: Update lastBidTime so calculateRemainingTime() returns the correct value
                state.lastBidTime = new Date(Date.now() - (state.timerDuration - state.timer) * 1000);

                if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);
                roomTimers[roomCode] = setInterval(() => {
                    tickAuctionTimer(roomCode, io);
                }, 1000); // Standard 1s interval
            } else {
                // We were stuck in a transition or at the very beginning
                loadNextPlayer(roomCode, io);
            }

            io.to(roomCode).emit('auction_resumed', { state });
        });

        // Request Force End (Step 1)
        socket.on('request_force_end', ({ roomCode }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod) return;
            
            // Prevent requesting end if already finishing
            if (state.status === 'Finished' || state.status === 'Evaluating' || state.isFinalizing) return;

            const humanOwners = state.teams
                .filter(t => !t.isBot && t.ownerUserId)
                .map(t => ({
                    userId: t.ownerUserId,
                    teamName: t.teamName,
                    socketId: t.ownerSocketId
                }));

            state.endRequest = {
                initiator: socket.userId || socket.id,
                acknowledgedBy: [socket.userId || socket.id], // Host auto-acknowledges
                requiredUsers: humanOwners.map(u => u.userId)
            };

            io.to(roomCode).emit('auction_end_requested', {
                endRequest: state.endRequest,
                humanOwners
            });
        });

        // Acknowledge Force End (Step 2)
        socket.on('acknowledge_force_end', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state || !state.endRequest) return;

            const userId = socket.userId || socket.id;
            if (!state.endRequest.acknowledgedBy.includes(userId)) {
                state.endRequest.acknowledgedBy.push(userId);
            }

            io.to(roomCode).emit('end_acknowledgement_update', {
                acknowledgedBy: state.endRequest.acknowledgedBy
            });
        });

        // Cancel Force End
        socket.on('cancel_force_end', ({ roomCode }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod) return;

            delete state.endRequest;
            io.to(roomCode).emit('auction_end_cancelled');
        });

        // Force End Auction Early (Final Step)
        socket.on('force_end_auction', ({ roomCode }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod) return;
            
            // Skip voting and end immediately
            finalizeManualEnd(roomCode, io);
            delete state.endRequest;
            io.to(roomCode).emit('auction_end_cancelled'); // Hide modal for all clients
        });

        // Update Room Settings (Host Only)
        socket.on('update_settings', ({ roomCode, timerDuration }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod) return;

            if ([3, 5, 7, 10].includes(timerDuration)) {
                state.timerDuration = timerDuration;
                
                // CRITICAL: Reset lastBidTime to now so the new duration starts from zero elapsed
                // This prevents the timer from jumping into negative values and triggering 
                // premature unsold statuses when the duration is shortened.
                state.lastBidTime = Date.now();
                state.timer = state.timerDuration;
                
                io.to(roomCode).emit('settings_updated', { 
                    timerDuration: state.timerDuration,
                    timer: state.timer 
                });
                
                // Persist the new lastBidTime to DB so recovery also works correctly
                persistActiveState(roomCode);
                
                console.log(`Room ${roomCode} settings updated: timerDuration = ${timerDuration}s, reset lastBidTime.`);
            }
        });

        // Update Lobby Settings (Host Only)
        socket.on('update_lobby_settings', ({ roomCode, allowSpectators, maxSpectators, teamCount }) => {
            const state = roomStates[roomCode];
            const mod = isModerator(state, socket.id, socket.userId);
            if (!state || !mod) return;

            if (typeof allowSpectators === 'boolean') state.allowSpectators = allowSpectators;
            if (typeof maxSpectators === 'number') state.maxSpectators = Math.min(10, Math.max(1, maxSpectators));
            if (typeof teamCount === 'number') {
                const targetLeague = String(state.league || '').toLowerCase();
                const validCounts = targetLeague === 'sa20' ? [6] : (targetLeague === 'wpl' ? [5] : [10, 15]);
                if (validCounts.includes(teamCount)) {
                    state.teamCount = teamCount;
                }
            }

            io.to(roomCode).emit('lobby_settings_updated', {
                allowSpectators: state.allowSpectators,
                maxSpectators: state.maxSpectators,
                teamCount: state.teamCount
            });
            
            console.log(`[LOBBY] Settings updated for ${roomCode}: Specs:${state.allowSpectators}, MaxSpecs:${state.maxSpectators}, Teams:${state.teamCount}`);
        });

        // Change Owner Name
        socket.on('change_owner_name', ({ roomCode, newName }) => {
            const state = roomStates[roomCode];
            if (!state || !newName || newName.trim().length === 0) return;
            if (newName.length > 20) return socket.emit('error', 'Name too long (Max 20 chars)');

            const nameLower = newName.toLowerCase().trim();
            const userId = socket.userId;

            // Check if name is taken
            const isTakenByTeam = state.teams.some(t => t.ownerUserId !== userId && t.ownerName?.toLowerCase().trim() === nameLower);
            const isTakenBySpec = (state.spectators || []).some(s => s.socketId !== socket.id && s.name?.toLowerCase().trim() === nameLower);
            if (isTakenByTeam || isTakenBySpec) {
                return socket.emit('error', 'This name is already taken in the room');
            }

            // Update in teams
            const team = state.teams.find(t => t.ownerUserId === userId);
            if (team) {
                team.ownerName = newName.trim();
                io.to(roomCode).emit('lobby_update', { teams: state.teams });
            }

            // Update in spectators
            const spec = (state.spectators || []).find(s => s.socketId === socket.id);
            if (spec) {
                spec.name = newName.trim();
                io.to(roomCode).emit('spectator_update', { spectators: state.spectators });
            }

            // Update hostName if host
            if (state.hostUserId === userId) {
                state.hostName = newName.trim();
            }

            console.log(`[LOBBY] User ${userId} changed name to: ${newName}`);
        });

        // --- INTEREST VOTING (Pool 3 & 4) ---
        socket.on('start_interest_voting', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state || state.host !== socket.id) return;

            // Acceleration Rule: All teams must have at least 15 players
            const allTeamsReached15 = state.teams.every(t => (t.playersAcquired || []).length >= 15);
            if (!allTeamsReached15) {
                return socket.emit('error', 'Accelerated phase can only start once every team has acquired at least 15 players.');
            }

            const votingPool = state.players.slice(state.currentIndex).filter(p => ['pool3', 'pool4'].includes(p.poolID));

            if (votingPool.length === 0) {
                return socket.emit('error', 'No Pool 3 or Pool 4 players remaining for voting');
            }

            state.votingSession = {
                active: true,
                isFinal: false,
                players: votingPool.map(p => ({ id: String(p._id), name: p.name || p.player, poolID: p.poolID })),
                playersData: votingPool, // Store actual objects here
                votes: {}, // teamId -> [playerIds]
                endsAt: Date.now() + 240000 // 240 seconds (4 minutes)
            };

            io.to(roomCode).emit('interest_voting_started', {
                players: state.votingSession.players,
                timer: 240,
                isFinal: false
            });

            // Pause the auction if it's currently running
            if (state.status === 'Auctioning') {
                state.status = 'Paused';
                state.wasRunningBeforeVoting = true;
                if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);
                io.to(roomCode).emit('auction_paused', {
                    state,
                    message: "Auction automatically paused for Interest Voting."
                });
            }

            // Auto-calculate after timer expires
            if (state.votingTimeout) clearTimeout(state.votingTimeout);
            state.votingTimeout = setTimeout(() => {
                const refreshedState = roomStates[roomCode];
                if (refreshedState && refreshedState.votingSession && refreshedState.votingSession.active) {
                    processVotingResults(roomCode, io);
                }
            }, 240500);
        });

        socket.on('submit_interest_votes', ({ roomCode, playerIds }) => {
            const state = roomStates[roomCode];
            if (!state || !state.votingSession || !state.votingSession.active) return;

            const team = state.teams.find(t => t.ownerSocketId === socket.id);
            if (!team) return;

            state.votingSession.votes[team.franchiseId] = playerIds;

            // Early completion check: Every team has cast their vote
            const totalTeams = state.teams.length;
            const votedTeams = Object.keys(state.votingSession.votes).length;

            if (votedTeams >= totalTeams) {
                console.log(`[VOTING] All franchises voted. Processing early results for room ${roomCode}...`);
                if (state.votingTimeout) clearTimeout(state.votingTimeout);
                processVotingResults(roomCode, io);
            }
        });

        // NOTE: resume_auction is handled above (line ~1736) with the correct
        // tickAuctionTimer function. This duplicate (calling non-existent tickTimer) has been removed.

        socket.on('disconnecting', () => {
            for (const roomCode of socket.rooms) {
                if (roomCode !== socket.id) {
                    socket.to(roomCode).emit('voice-user-left', { socketId: socket.id });
                }
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);

            // For every active room, if this userId was a participant, broadcast an offline update
            const userId = socket.userId;
            if (!userId) return;

            for (const roomCode of Object.keys(roomStates)) {
                const state = roomStates[roomCode];
                if (!state) continue;

                const isParticipant = state.teams?.some(t => t.ownerUserId === userId) ||
                    state.spectators?.some(s => s.userId === userId);

                if (isParticipant) {
                    // Small delay before marking offline to account for quick reloads
                    setTimeout(() => {
                        const currentState = roomStates[roomCode];
                        if (!currentState) return;

                        // Check if the user has re-connected with a new socket in the meantime
                        const isBack = currentState.teams?.some(t => t.ownerUserId === userId && t.ownerSocketId !== socket.id) ||
                            currentState.spectators?.some(s => s.userId === userId && s.socketId !== socket.id);

                        if (!isBack) {
                            const onlineMap = {};
                            currentState.teams?.forEach(t => {
                                if (t.ownerUserId) onlineMap[t.ownerUserId] = (t.ownerUserId !== userId);
                            });
                            currentState.spectators?.forEach(s => {
                                if (s.userId) onlineMap[s.userId] = (s.userId !== userId);
                            });
                            io.to(roomCode).emit('player_status_update', { onlineMap });

                            // HOST MIGRATION: If host disconnects for > 30s during meat of auction, promote someone else
                            if (currentState.hostUserId === userId && currentState.status !== 'Lobby' && currentState.status !== 'Finished') {
                                console.log(`[HOST] Original host ${userId} offline (disconnect). Starting promotion timeout...`);
                                // Clear existing timeout if any
                                if (hostPromotionTimers[roomCode]) clearTimeout(hostPromotionTimers[roomCode]);
                                hostPromotionTimers[roomCode] = setTimeout(() => {
                                    const finalCheck = roomStates[roomCode];
                                    if (finalCheck && (finalCheck.hostUserId === userId || !io.sockets.sockets.has(finalCheck.host))) {
                                        promoteNewHost(roomCode, io);
                                    }
                                }, 30000);
                            }
                        }
                    }, 2000);
                }
            }
        });

        // Add explicit claim_host feature
        socket.on('claim_host', ({ roomCode }) => {
            const state = roomStates[roomCode];
            if (!state) return;

            // Only allow if the current host is actually offline
            const hostIsOnline = state.host && io.sockets.sockets.has(state.host);
            if (!hostIsOnline) {
                console.log(`[HOST] Explicit claim by ${socket.id} for room ${roomCode}`);
                promoteNewHost(roomCode, io, socket.id);
            } else {
                socket.emit('error', 'The current host is still online and active.');
            }
        });

        // Add toggle_cohost feature
        socket.on('toggle_cohost', async ({ roomCode, userId: targetUserId }) => {
            const state = roomStates[roomCode];
            if (!state) return;

            // ONLY the primary host can manage co-hosts
            const isPrimary = (socket.userId && state.hostUserId === socket.userId) || state.host === socket.id;
            if (!isPrimary) return socket.emit('error', 'Only the primary host can manage co-hosts.');

            if (!state.coHostUserIds) state.coHostUserIds = [];

            const index = state.coHostUserIds.indexOf(targetUserId);
            if (index === -1) {
                // Add Co-Host (Max 3)
                if (state.coHostUserIds.length >= 3) {
                    return socket.emit('error', 'Maximum 3 co-hosts allowed.');
                }
                state.coHostUserIds.push(targetUserId);
                console.log(`[HOST] User ${targetUserId} added as Co-Host in room ${roomCode}`);
            } else {
                // Remove Co-Host
                state.coHostUserIds.splice(index, 1);
                console.log(`[HOST] User ${targetUserId} removed as Co-Host in room ${roomCode}`);
            }

            // Sync to DB
            await AuctionRoom.findOneAndUpdate({ roomId: roomCode }, {
                coHostUserIds: state.coHostUserIds
            });

            // Broadcast update to everyone
            io.to(roomCode).emit('cohosts_updated', { coHostUserIds: state.coHostUserIds });
        });
    });
};

function promoteNewHost(roomCode, io, specificSocketId = null) {
    const state = roomStates[roomCode];
    if (!state) return;

    if (hostPromotionTimers[roomCode]) {
        clearTimeout(hostPromotionTimers[roomCode]);
        delete hostPromotionTimers[roomCode];
    }

    let nextHost = null;
    if (specificSocketId && io.sockets.sockets.has(specificSocketId)) {
        // Find user by socket ID
        nextHost = [
            ...state.teams.map(t => ({ socketId: t.ownerSocketId, userId: t.ownerUserId, name: t.ownerName })),
            ...(state.spectators || []).map(s => ({ socketId: s.socketId, userId: s.userId, name: s.name }))
        ].find(x => x.socketId === specificSocketId);
    }

    if (!nextHost) {
        // Favor team owners first, then spectators
        const potentialHosts = [
            ...state.teams.map(t => ({ socketId: t.ownerSocketId, userId: t.ownerUserId, name: t.ownerName })),
            ...(state.spectators || []).map(s => ({ socketId: s.socketId, userId: s.userId, name: s.name }))
        ].filter(p => p.socketId && io.sockets.sockets.has(p.socketId));

        if (potentialHosts.length > 0) {
            nextHost = potentialHosts[0];
        }
    }

    if (nextHost) {
        state.host = nextHost.socketId;
        state.hostUserId = nextHost.userId;
        state.hostName = nextHost.name;

        io.to(roomCode).emit('host_changed', {
            newHost: { socketId: state.host, name: state.hostName, userId: state.hostUserId }
        });

        io.to(roomCode).emit('receive_chat_message', {
            id: Date.now(),
            senderName: 'System',
            senderTeam: 'System',
            senderColor: '#ef4444',
            message: `Host migration event: ${state.hostName} is now the moderator.`,
            timestamp: new Date().toLocaleTimeString()
        });

        // Update DB
        AuctionRoom.findOneAndUpdate({ roomId: roomCode }, {
            hostSocketId: state.host,
            hostUserId: state.hostUserId,
            hostName: state.hostName
        }).exec();
        console.log(`[HOST] Migration successful for room ${roomCode}. New host: ${state.hostName}`);
    } else {
        console.log(`[HOST] Migration failed: No active participants to promote in room ${roomCode}`);
    }
}

function loadNextPlayer(roomCode, io) {
    const state = roomStates[roomCode];
    // Allow loading next if we are transitioning from Sold or Unsold states
    const validStatuses = ['Auctioning', 'Sold', 'Unsold', 'Lobby'];
    if (!state || !validStatuses.includes(state.status)) return;

    if (state.currentIndex >= state.players.length) {
        handleAuctionEndTransition(roomCode, io);
        return;
    }

    // --- EXHAUSTION CHECK ---
    // Auto-end if every team is either full (25 players) OR can't afford
    // the cheapest remaining player's base price.
    const remainingPlayers = state.players.slice(state.currentIndex);
    const lowestBasePrice = remainingPlayers.reduce((min, p) => {
        const bp = p.basePrice || 0;
        return bp < min ? bp : min;
    }, Infinity);

    const maxSquad = state.league === 'wpl' ? 18 : (state.league === 'sa20' ? 19 : 25);
    const allTeamsExhausted = state.teams.length > 0 && state.teams.every(t => {
        const isFull = (t.playersAcquired?.length || 0) >= maxSquad;
        const cantAfford = t.currentPurse < 30; // Min bidding threshold requested by user
        return isFull || cantAfford;
    });

    if (allTeamsExhausted) {
        console.log(`\n--- ALL TEAMS EXHAUSTED (budget/roster) in Room ${roomCode}. Lowest remaining base price: ₹${lowestBasePrice}L. Auto-ending auction. ---`);
        io.to(roomCode).emit('receive_chat_message', {
            id: Date.now(),
            senderName: 'System',
            senderTeam: 'System',
            senderColor: '#ef4444',
            message: `Auction auto-ended: All teams have either a full squad or insufficient budget to bid on any remaining player (lowest base price ₹${lowestBasePrice}L).`,
            timestamp: new Date().toLocaleTimeString()
        });
        handleAuctionEndTransition(roomCode, io);
        return;
    }
    // --- END EXHAUSTION CHECK ---

    const player = state.players[state.currentIndex];
    const nextPlayers = state.players.slice(state.currentIndex + 1);

    state.currentBid = { amount: 0, teamId: null, teamName: null, teamColor: null, teamLogo: null, ownerName: null };
    state.timer = state.timerDuration;
    // Bug 2 fix: set timerEndsAt here so place_bid time-validation works immediately
    // when the first bid arrives for this player.
    state.timerEndsAt = Date.now() + (state.timerDuration * 1000);

    // --- LEGEND PAUSE LOGIC ---
    const playerName = player.player || player.name || "";
    // [MOD] Skip legend intro in AI mode
    const isLegend = isLegendPlayer(playerName, state.league) && state.currentIndex > 0 && !state.isAiMode;

    let rtmEligibleTeamName = null;
    let rtmEligibleTeamId = null;
    if (state.league === 'wpl' || state.league === 'sa20') {
        const prevTeam = findPreviousTeamForPlayer(state, playerName);
        if (prevTeam) {
            const rtmLeft = (prevTeam.rtmCards || 0) - (prevTeam.rtmUsedCount || 0);
            if (rtmLeft > 0) {
                rtmEligibleTeamName = prevTeam.teamName;
                rtmEligibleTeamId = prevTeam.franchiseId;
            }
        }
    }

    state.currentPlayer = {
        ...player, // Retain ALL fields (stats, image_path, role, etc.) for UI sync
        id: String(player._id || player.id),
        name: playerName,
        basePrice: player.basePrice || player.base_price,
        poolID: player.poolID || player.originalPool,
        rtmEligibleTeamName,
        rtmEligibleTeamId
    };
    state.lastBidTime = new Date();
    
    if (isLegend) {
        // Paused state -> No timer running
        ActiveRoom.updateOne({ roomCode }, { $set: { isTimerRunning: false, auctionStatus: 'Paused' } }).exec();

        console.log(`[LEGEND] ${playerName} detected. Pausing auction for 7s intro.`);
        state.status = 'Paused';
        state.timer = 0; // Show 0 or static timer during intro
        
        io.to(roomCode).emit('new_player', {
            player,
            nextPlayers,
            timer: state.timerDuration,
            isInitial: state.currentIndex === 0,
            skippedHistory: state.skippedHistory || []
        });

        io.to(roomCode).emit('auction_paused');
        if (roomTimers[roomCode]) {
            clearInterval(roomTimers[roomCode]);
            delete roomTimers[roomCode];
        }

        setTimeout(() => {
            const refreshedState = roomStates[roomCode];
            if (refreshedState && refreshedState.status === 'Paused' && refreshedState.currentIndex === state.currentIndex) {
                console.log(`[LEGEND] Intro finished for ${playerName}. Resuming auction.`);
                refreshedState.status = 'ONGOING';
                refreshedState.timer = refreshedState.timerDuration;
                refreshedState.lastBidTime = new Date();
                // Bug 2+6 fix: reset timerEndsAt so place_bid validation is correct
                refreshedState.timerEndsAt = Date.now() + (refreshedState.timerDuration * 1000);

                // Set DB lock
                ActiveRoom.updateOne({ roomCode }, { $set: { isTimerRunning: true, auctionStatus: 'ONGOING', lastBidTime: refreshedState.lastBidTime } }).exec();

                if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);
                roomTimers[roomCode] = setInterval(() => {
                    tickAuctionTimer(roomCode, io);
                }, 1000);

                // Bug 6 fix: client stays paused until it receives auction_resumed
                io.to(roomCode).emit('auction_resumed', { timer: refreshedState.timerDuration });
            }
        }, 7000); // 7s duration
    } else {
        state.status = 'ONGOING';
        
        // Set DB lock
        ActiveRoom.updateOne({ roomCode }, { $set: { isTimerRunning: true, auctionStatus: 'ONGOING' } }).exec();

        io.to(roomCode).emit('new_player', {
            player,
            nextPlayers, // Full catalog for carousel and pools view
            timer: state.timer,
            isInitial: state.currentIndex === 0,
            skippedHistory: state.skippedHistory || []
        });

        if (roomTimers[roomCode]) clearInterval(roomTimers[roomCode]);

        roomTimers[roomCode] = setInterval(() => {
            tickAuctionTimer(roomCode, io);
        }, 1000);
    }

    persistActiveState(roomCode);
}


/**
 * getBotValuation - Estimates how much a bot is willing to pay for a player.
 * Now dynamic based on player pool, bot "personality", and squad urgency.
 */
function getBotValuation(player, bot, currentSquadSize = 0, league = 'ipl') {
    if (!player) return 0;
    const basePrice = player.basePrice || 100;
    const pool = (player.poolID || "").toLowerCase();
    const botName = bot.ownerName;

    // Base multipliers and thresholds
    let minMult = 1.2;
    let maxMult = 2.5;
    let starChance = 0.1;
    
    // Default Caps (Pool 2, etc.)
    let maxCap = 500; // 5cr

    if (pool.includes('marquee')) {
        minMult = 5.0; // More aggressive minimum
        maxMult = 10.0; // Up to 20cr
        starChance = 0.15;
        maxCap = 2000;
    } else if (pool.includes('pool1')) {
        minMult = 2.5;
        maxMult = 6.0; // Up to 9cr (150*6) or (200*4.5)
        starChance = 0.1;
        maxCap = 900;
    } else if (pool.includes('pool2')) {
        minMult = 1.5;
        maxMult = 3.5;
        starChance = 0.05;
        maxCap = 500;
    } else if (pool.includes('emerging')) {
        minMult = 2.0;
        maxMult = 6.0; // Up to 2.4cr
        starChance = 0.05;
        maxCap = 400;
    }

    // Uncapped rules for SA20: if SA20, player is uncapped, and bot has < 2 uncapped, boost valuation
    if (league === 'sa20' && isSa20UncappedAcquired(player)) {
        const uncappedCount = (bot.playersAcquired || []).filter(p => isSa20UncappedAcquired(p)).length;
        if (uncappedCount < 2) {
            const boost = uncappedCount === 0 ? 1.8 : 1.4;
            minMult *= boost;
            maxMult *= boost;
            maxCap *= boost;
        }
    }

    // --- BUDGET AWARENESS ---
    const currentPurse = bot.currentPurse || 0;
    const startPurse = bot.startingPurse || 12000;
    const totalBudget = startPurse;
    const purseRatio = currentPurse / totalBudget;
    
    // Exponential damping as budget runs low
    // If purseRatio is 1.0, factor is 1.0. If 0.5, factor is 0.7. If 0.2, factor is ~0.45.
    const budgetFactor = Math.pow(purseRatio, 0.6);
    
    maxMult *= budgetFactor;
    minMult = Math.min(minMult, maxMult);
    maxCap *= budgetFactor;

    // Identity-based variation
    const nameHash = botName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const personalityFactor = (nameHash % 10) / 10; 

    // starFactor (Extreme/Crucial player logic)
    const isExtreme = Math.random() < starChance;
    if (isExtreme) {
        maxMult += (2.0 * budgetFactor);
        maxCap += ((startPurse * 0.025) * budgetFactor); // Proportional star boost (e.g. 300L for 12000L, 8.5L for 340L)
    }

    // [RULE] Urgency Factor: If below targetMin players, bots become more desperate
    const targetMin = startPurse <= 500 ? 17 : (startPurse <= 2000 ? 15 : 18);
    const minReservePerPlayer = getMinReservePerPlayer(startPurse);

    if (currentSquadSize < targetMin) {
        const urgencyBoost = (targetMin - currentSquadSize) * 0.25; // Adjusted
        minMult += urgencyBoost;
        maxMult += urgencyBoost;
        // Do NOT add to maxCap here, keep caps absolute per pool
    }

    // [RULE] 80/20 Budget Strategy
    // 80% of purse for first 10 players. 20% for remaining.
    if (currentSquadSize < 10) {
        // Strict cap per player in early phase to prevent single-player blowout
        const spendingCap = startPurse * 0.175; // 17.5% of starting purse (e.g. 2100L for IPL, 59.5L for SA20)
        if (maxCap > spendingCap) maxCap = spendingCap;
        
        // Dynamic Ceiling based on current avg slot value
        const slotsNeeded = Math.max(1, 10 - currentSquadSize);
        const targetRemainingForTop10 = (startPurse * 0.8) - (startPurse - currentPurse); 
        const avgRemainingInPhase = Math.max(0, targetRemainingForTop10 / slotsNeeded);
        
        // Adding personality-based jitter to differentiate bots.
        const personalityNoise = 0.9 + (personalityFactor * 0.2); // 0.9x to 1.1x
        const dynamicCeiling = Math.max(basePrice * 1.5, (avgRemainingInPhase * 1.8 * personalityNoise));
        if (maxCap > dynamicCeiling) maxCap = dynamicCeiling;
    } else {
        // Calculative phase: Strictly reserve for targetMin players
        const neededForMin = Math.max(1, targetMin - currentSquadSize);
        // Reserve minReservePerPlayer per player + slightly more buffer
        const reserveMargin = neededForMin * minReservePerPlayer * 1.2; 
        const safeMax = (currentPurse - reserveMargin) / neededForMin;
        
        const phaseCap = Math.max(basePrice * 1.2, safeMax);
        if (maxCap > phaseCap) maxCap = phaseCap;
    }

    const finalMin = minMult + (personalityFactor * 0.5);
    const finalMax = finalMin + 0.5 + (personalityFactor * 2.0); // Ensure gap

    const multiplier = finalMin + (Math.random() * (finalMax - finalMin));
    
    // Helper to ensure all bids are in standard increments based on league starting purse
    const roundToStandard = (val) => {
        if (league === 'sa20') {
            // SA20: Round to nearest 0.25 (R25k)
            return Math.max(1.0, Math.floor(val / 0.25) * 0.25);
        } else if (league === 'wpl') {
            // WPL: Round to nearest 5L
            return Math.max(10, Math.floor(val / 5) * 5);
        } else {
            // IPL: Round to nearest 25L
            return Math.max(25, Math.floor(val / 25) * 25);
        }
    };

    let valuation = roundToStandard(basePrice * multiplier);
    
    // Personality-based variation for caps (prevents identical stops)
    const personalityNoise = 0.95 + (personalityFactor * 0.1); // 0.95 to 1.05 multiplier

    // Apply noise to maxCap if it's set
    maxCap = roundToStandard(maxCap * personalityNoise);

    if (valuation > maxCap) valuation = maxCap;

    return valuation;
}

/**
 * handleBotBidding - Evaluates and places bids for bots in AI mode.
 */
/**
 * fillRoomWithBots - Automatically fills all remaining available franchise slots
 * with AI bots. Used in Play with AI mode after host claims their team.
 */
async function fillRoomWithBots(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || !state.isAiMode) return;

    console.log(`[AI-MODE] Filling room ${roomCode} with bots...`);

    const pool = [...state.availableTeams];
    // Fisher-Yates shuffle the available franchisees list
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Fill all available slots
    const PlayerCache = state.league === 'sa20' ? require('../utils/PlayerCache') : null;
    const botsToAdd = [];
    AI_BOTS.slice(0, pool.length).forEach((botDef, index) => {
        const teamDef = pool.pop();
        const botTeam = {
            franchiseId: teamDef._id,
            teamName: teamDef.name,
            teamThemeColor: teamDef.primaryColor,
            teamLogo: teamDef.logoUrl,
            ownerSocketId: `socket_${botDef.userId}`,
            ownerUserId: botDef.userId,
            ownerName: botDef.name,
            isBot: true,
            currentPurse: teamDef.purseLimit || 12000,
            startingPurse: teamDef.purseLimit || 12000,
            overseasCount: 0,
            rtmUsed: false,
            rtmCards: getTeamRtmCards(state, teamDef.name),
            rtmUsedCount: 0,
            playersAcquired: []
        };
        botsToAdd.push(botTeam);
    });

    state.teams.push(...botsToAdd);
    state.availableTeams = []; // All teams now claimed

    // Sync to DB and broadcast
    markDirty(roomCode, { franchisesInRoom: state.teams });
    io.to(roomCode).emit('lobby_update', { teams: lightweightTeams(state.teams, state.league) });
    io.to(roomCode).emit('available_teams', { teams: [] });

    console.log(`[AI-MODE] Successfully added ${botsToAdd.length} bots to room ${roomCode}`);
}

function handleBotBidding(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || !state.isAiMode || (state.status !== 'Auctioning' && state.status !== 'ONGOING')) return;

    const currentPlayer = state.players[state.currentIndex];
    if (!currentPlayer) return;

    // Filter bots that can actually bid
    const eligibleBots = state.teams.filter(t => {
        const squadSize = t.playersAcquired?.length || 0;
        const overseasCount = t.overseasCount || 0;
        
        const startPrice = (state.league === 'wpl' || state.league === 'sa20') ? (currentPlayer.basePrice || 10) : Math.max(25, Math.floor((currentPlayer.basePrice || 0) / 25) * 25);
        const nextBid = getRequiredBid(state.currentBid.amount || 0, startPrice, currentPlayer.poolID, state.league);

        const maxSquad = state.league === 'wpl' ? 18 : (state.league === 'sa20' ? 19 : 25);
        const maxOverseas = state.league === 'wpl' ? 6 : (state.league === 'sa20' ? 7 : 8);
        return t.isBot && 
               t.currentPurse >= nextBid && 
               squadSize < maxSquad && 
               !(currentPlayer.isOverseas && overseasCount >= maxOverseas) && 
               state.currentBid.teamId !== t.franchiseId &&
               isBotSustainable(t, nextBid) &&
               !isBotOverBudget(t, nextBid); // [STRICT] 80/20 Rule
    });

    if (eligibleBots.length === 0) return;

    // Shuffle bots to give them equal chance to bid first in a tick
    const shuffledBots = [...eligibleBots].sort(() => Math.random() - 0.5);

    for (const bot of shuffledBots) {
        // Dynamic Hesitation: Aggressive (quick bids) vs Calculative (slow/hesitant)
        const currentAmt = state.currentBid.amount;
        const poolID = (currentPlayer.poolID || "").toLowerCase();
        let aggressiveThreshold = 300; // Default (Pool 2)

        if (poolID.includes('marquee')) aggressiveThreshold = 1000;
        else if (poolID.includes('pool1')) aggressiveThreshold = 500;
        else if (poolID.includes('emerging')) aggressiveThreshold = 250;

        const isAggressivePhase = currentAmt < aggressiveThreshold;
        
        // Human-like hesitation based on phase
        // In aggressive phase, 90% chance to bid per 500ms tick
        // In calculative phase, slow down significantly to 20% chance
        const bidChance = isAggressivePhase ? 0.9 : 0.20;
        if (Math.random() > bidChance) continue; 
 
        const valuation = getBotValuation(currentPlayer, bot, bot.playersAcquired?.length || 0, state.league);
        const startPrice = (state.league === 'wpl' || state.league === 'sa20') ? (currentPlayer.basePrice || 10) : Math.max(25, Math.floor((currentPlayer.basePrice || 0) / 25) * 25);
        const nextBidAmount = getRequiredBid(currentAmt, startPrice, currentPlayer.poolID, state.league);

        if (nextBidAmount <= valuation && nextBidAmount <= bot.currentPurse) {
            // ATOMIC UPDATE for Bots
            ActiveRoom.findOneAndUpdate(
                { 
                    roomCode, 
                    "currentBid.amount": currentAmt, 
                    auctionStatus: 'ONGOING' 
                },
                {
                    $set: {
                        currentBid: {
                            amount: nextBidAmount,
                            teamId: bot.franchiseId,
                            teamName: bot.teamName,
                            ownerUserId: bot.ownerUserId
                        },
                        lastBidTime: new Date()
                    },
                    $push: {
                        last5Bids: {
                            $each: [{
                                amount: nextBidAmount,
                                teamName: bot.teamName,
                                timestamp: new Date()
                            }],
                            $slice: -5
                        }
                    }
                },
                { returnDocument: 'after' }
            ).then(updatedRoom => {
                if (updatedRoom) {
                    state.currentBid = { 
                        amount: nextBidAmount, 
                        teamId: bot.franchiseId, 
                        teamName: bot.teamName, 
                        teamColor: bot.teamThemeColor, 
                        teamLogo: bot.teamLogo, 
                        ownerName: bot.ownerName 
                    };
                    state.lastBidTime = updatedRoom.lastBidTime;
                    state.last5Bids = updatedRoom.last5Bids;
                    state.timer = state.timerDuration;
                    // Bug 3 fix: reset timerEndsAt after bot bid so human
                    // bid validation (which reads timerEndsAt) sees full time left.
                    state.timerEndsAt = Date.now() + (state.timerDuration * 1000);

                    console.log(`[BOT-ATOMIC] ${bot.ownerName} outbid to ${nextBidAmount}L`);
                    emitFullAuctionState(roomCode, io);
                }
            }).catch(err => {
                console.error(`[BOT-ERR] Atomic update failed for bot:`, err.message);
            });
            
            break; // Only one bot bid per tick
        }
    }
}

function tickAuctionTimer(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || (state.status !== 'ONGOING' && state.status !== 'Auctioning')) {
        if (roomTimers[roomCode]) {
            clearInterval(roomTimers[roomCode]);
            delete roomTimers[roomCode];
        }
        return;
    }

    const remaining = calculateRemainingTime(state);
    
    // Smooth countdown for UI (even if DB is slightly behind)
    if (state.timer !== remaining) {
        state.timer = remaining;
    }

    // Every second, sync the full state to prevent UI drift
    emitFullAuctionState(roomCode, io);

    // [NEW] Bot Bidding Logic for AI Mode
    if (state.isAiMode && remaining > 0) {
        handleBotBidding(roomCode, io);
    }

    // Grace Period: Finalize only if remaining time is -1
    // This allows a 1-second buffer for late network bids to reach the server.
    if (remaining <= -1) { // 1s grace period (ceil makes it hit -1 at now > timerEndsAt + 1s)
        console.log(`[TIMER] Auction loop for ${state.currentPlayer?.name} finished (Grace period exceeded).`);
        clearInterval(roomTimers[roomCode]);
        delete roomTimers[roomCode];
        
        // Release DB lock
        ActiveRoom.updateOne({ roomCode }, { $set: { isTimerRunning: false } }).exec();

        // Finalize player
        checkAndTriggerRTM(roomCode, io);
    }
}

/**
 * autoResolveCurrentPlayer - Instantly simulates a bidding war among bots
 * for the current player. Used when a user skips a player or pool.
 */
async function autoResolveCurrentPlayer(roomCode, io, nextPlayerDelay = 3000) {
    const state = roomStates[roomCode];
    if (!state || !state.isAiMode) return;

    const currentPlayer = state.players[state.currentIndex];
    if (!currentPlayer) return;

    // Simulate bot war
    let currentBidAmount = state.currentBid.amount || 0;
    
    // Find all bots interested
    let interestedBots = state.teams
        .filter(t => t.isBot && t.franchiseId !== state.currentBid.teamId)
        .map(bot => {
            const valuation = getBotValuation(currentPlayer, bot, bot.playersAcquired?.length || 0, state.league);
            const squadSize = bot.playersAcquired?.length || 0;
            const overseasCount = bot.overseasCount || 0;

            const maxSquad = state.league === 'wpl' ? 18 : (state.league === 'sa20' ? 19 : 25);
            const maxOverseas = state.league === 'wpl' ? 6 : (state.league === 'sa20' ? 7 : 8);
            const canAfford = bot.currentPurse >= minNextBid;
            const notFull = squadSize < maxSquad;
            const osLimitNotReached = !(currentPlayer.isOverseas && overseasCount >= maxOverseas);
            const wantsToPayMore = valuation >= minNextBid;
            const sustainable = isBotSustainable(bot, minNextBid);
            const notOverBudget = !isBotOverBudget(bot, minNextBid);

            if (canAfford && notFull && osLimitNotReached && wantsToPayMore && sustainable && notOverBudget) {
                return { bot, valuation };
            }
            return null;
        })
        .filter(b => b !== null);

    if (interestedBots.length > 0) {
        // Sort by valuation descending
        interestedBots.sort((a, b) => b.valuation - a.valuation);

        const winner = interestedBots[0];
        const runnerUpVal = interestedBots[1]?.valuation || currentBidAmount;

        // Winning price is max(basePrice, currentAmt, runnerUp valuation + 25)
        // [FIX] Ensure finalPrice is rounded to 25L increments
        let step = 25;
        if (state.league === 'wpl') {
            step = 5;
        } else if (state.league === 'sa20') {
            step = 0.25;
        }
        let finalPrice = Math.max(currentPlayer.basePrice, currentBidAmount, (Math.floor(runnerUpVal / step) * step) + step);
        if (finalPrice > winner.valuation) finalPrice = winner.valuation;
        if (finalPrice > winner.bot.currentPurse) finalPrice = (Math.floor(winner.bot.currentPurse / step) * step);

        state.currentBid = {
            amount: finalPrice,
            teamId: winner.bot.franchiseId,
            teamName: winner.bot.teamName,
            teamColor: winner.bot.teamThemeColor,
            teamLogo: winner.bot.teamLogo,
            ownerName: winner.bot.ownerName
        };

        // [LOG] Log the resolved war
        console.log(`[AI-RESOLVE] Bidding war for ${currentPlayer.name} resolved at ${finalPrice}L. Winner: ${winner.bot.teamName}`);

        // Broadcast the last bid so UI updates BEFORE the sold event
        io.to(roomCode).emit('bp', {
            cb: {
                a: finalPrice,
                tid: winner.bot.franchiseId,
                tn: winner.bot.teamName,
                tc: winner.bot.teamThemeColor,
                tl: winner.bot.teamLogo,
                on: winner.bot.ownerName
            },
            t: state.timer
        });
    }

    // Process sale
    await checkAndTriggerRTM(roomCode, io, nextPlayerDelay);
}

function findPreviousTeamForPlayer(state, playerName) {
    if (!state.retentionSquads) return null;
    const canonicalSearchName = canonicalizePlayerName(playerName);
    for (const team of state.teams) {
        const squad = findTeamRetentionSquad(state, team.teamName);
        if (!squad) continue;
        const found = squad.some(p => canonicalizePlayerName(p.name || p) === canonicalSearchName);
        if (found) return team;
    }
    return null;
}

function tickRtmTimer(roomCode, io) {
    const state = roomStates[roomCode];
    if (!state || state.status !== 'RTM' || !state.rtmState) {
        if (roomTimers[roomCode]) {
            clearInterval(roomTimers[roomCode]);
            delete roomTimers[roomCode];
        }
        return;
    }

    const remaining = Math.max(0, Math.ceil((state.rtmState.timerEndsAt - Date.now()) / 1000));
    state.rtmState.timer = remaining;

    // Broadcast full state
    emitFullAuctionState(roomCode, io);

    if (remaining <= 0) {
        console.log(`[RTM] Timer expired for ${state.rtmState.prevTeamName}. Automatically passing.`);
        handleRtmDecision(roomCode, io, false);
    }
}

async function handleRtmDecision(roomCode, io, useRtm) {
    const state = roomStates[roomCode];
    if (!state || state.status !== 'RTM' || !state.rtmState) return;

    // Clear RTM timer
    if (roomTimers[roomCode]) {
        clearInterval(roomTimers[roomCode]);
        delete roomTimers[roomCode];
    }

    const { prevTeamId, prevTeamName, playerName, bidAmount, nextPlayerDelay } = state.rtmState;

    if (useRtm) {
        // Find previous team
        const prevTeam = state.teams.find(t => t.franchiseId === prevTeamId);
        if (prevTeam) {
            // RTM match!
            state.currentBid = {
                amount: bidAmount,
                teamId: prevTeam.franchiseId,
                teamName: prevTeam.teamName,
                teamColor: prevTeam.teamThemeColor,
                teamLogo: prevTeam.teamLogo,
                ownerName: prevTeam.ownerName,
                ownerUserId: prevTeam.ownerUserId,
                isRtm: true
            };
            
            // Increment rtmUsedCount
            prevTeam.rtmUsedCount = (prevTeam.rtmUsedCount || 0) + 1;
            prevTeam.rtmUsed = true;

            console.log(`[RTM] ${prevTeamName} matched bid of ${bidAmount}L for ${playerName}!`);
            // Emit RTM usage visually if needed, but DO NOT emit a raw chat message 
            // since the subsequent 'player_sold' event will log the RTM acquisition cleanly.
        }
    } else {
        console.log(`[RTM] ${prevTeamName} passed on matching bid of ${bidAmount}L for ${playerName}.`);
    }

    // Clean up rtmState
    state.rtmState = null;
    state.status = 'ONGOING';

    // Update ActiveRoom in mongo to clear RTM status and state
    await ActiveRoom.updateOne({ roomCode }, {
        $set: {
            rtmState: null,
            teams: state.teams
        }
    }).exec().catch(err => console.warn(`[RTM] ActiveRoom clean failed:`, err.message));

    // Proceed to standard hammer down
    await processHammerDown(roomCode, io, nextPlayerDelay);
}

function checkAndTriggerRTM(roomCode, io, nextPlayerDelay = 3000) {
    const state = roomStates[roomCode];
    if (!state) return;

    const player = state.currentPlayer;
    const playerName = player ? (player.player || player.name || 'Unknown Player') : 'Unknown Player';

    if (state.currentBid.amount > 0 && (state.league === 'wpl' || state.league === 'sa20')) {
        const prevTeam = findPreviousTeamForPlayer(state, playerName);
        if (prevTeam) {
            const rtmLeft = (prevTeam.rtmCards || 0) - (prevTeam.rtmUsedCount || 0);
            const maxSquad = state.league === 'wpl' ? 18 : (state.league === 'sa20' ? 19 : 25);
            const maxOverseas = state.league === 'wpl' ? 6 : (state.league === 'sa20' ? 7 : 8);
            const prevTeamOverseasCount = (prevTeam.playersAcquired || []).filter(p => p.isOverseas || p.overseas).length;
            const isOverseasLimitReached = player && (player.isOverseas || player.overseas) && prevTeamOverseasCount >= maxOverseas;
            const isSquadFull = (prevTeam.playersAcquired?.length || 0) >= maxSquad;
            const canAfford = prevTeam.currentPurse >= state.currentBid.amount;
            const hasRtmCards = rtmLeft > 0;
            const isNotHighestBidder = state.currentBid.teamId !== prevTeam.franchiseId;

            if (isNotHighestBidder && hasRtmCards && canAfford && !isSquadFull && !isOverseasLimitReached) {
                console.log(`[RTM] Intercepting hammer down. Triggering RTM for ${playerName} (owned by ${prevTeam.teamName} last season)`);
                
                if (roomTimers[roomCode]) {
                    clearInterval(roomTimers[roomCode]);
                    delete roomTimers[roomCode];
                }

                state.status = 'RTM';
                state.rtmState = {
                    prevTeamId: prevTeam.franchiseId,
                    prevTeamName: prevTeam.teamName,
                    prevTeamOwnerUserId: prevTeam.ownerUserId,
                    playerName: playerName,
                    bidAmount: state.currentBid.amount,
                    timer: 15,
                    timerEndsAt: Date.now() + 15000,
                    nextPlayerDelay
                };

                ActiveRoom.updateOne({ roomCode }, {
                    $set: {
                        auctionStatus: 'RTM',
                        rtmState: state.rtmState,
                        isTimerRunning: false
                    }
                }).exec().catch(err => console.warn(`[RTM] ActiveRoom update failed:`, err.message));

                emitFullAuctionState(roomCode, io);

                roomTimers[roomCode] = setInterval(() => {
                    tickRtmTimer(roomCode, io);
                }, 1000);

                if (prevTeam.isBot) {
                    setTimeout(() => {
                        const currState = roomStates[roomCode];
                        if (currState && currState.status === 'RTM' && currState.rtmState?.playerName === playerName) {
                            const valuation = getBotValuation(player, prevTeam, prevTeam.playersAcquired?.length || 0, currState.league);
                            const useRtm = valuation >= currState.currentBid.amount;
                            console.log(`[RTM-BOT] Bot ${prevTeam.teamName} decided to ${useRtm ? 'USE' : 'PASS'} RTM for ${playerName}`);
                            handleRtmDecision(roomCode, io, useRtm);
                        }
                    }, 2000);
                }
                return; // Intercepted
            } else {
                console.log(`[RTM-SKIP] RTM not triggered for ${playerName}: isNotHighestBidder=${isNotHighestBidder}, rtmLeft=${rtmLeft}, canAfford=${canAfford}, isSquadFull=${isSquadFull}, isOverseasLimitReached=${isOverseasLimitReached}`);
            }
        }
    }

    // Default: hammer down
    processHammerDown(roomCode, io, nextPlayerDelay);
}

async function processHammerDown(roomCode, io, nextPlayerDelay = 3000) {
    const state = roomStates[roomCode];
    if (!state) return;
    if (state.status !== 'ONGOING' && state.status !== 'Auctioning') return; // Prevent double triggers

    // Release DB lock immediately
    ActiveRoom.updateOne({ roomCode }, { $set: { isTimerRunning: false } }).exec();

    const player = state.players[state.currentIndex];
    const playerName = player.player || player.name || 'Unknown Player';

    if (state.currentBid.amount > 0) {
        state.status = 'Sold'; // Temporarily pause for sale animation
        // Player Sold
        const winningTeamIndex = state.teams.findIndex(t => t.franchiseId === state.currentBid.teamId);
        let winningSocketId = null;

        if (winningTeamIndex !== -1) {
            state.teams[winningTeamIndex].currentPurse -= state.currentBid.amount;
            if (player.isOverseas) {
                state.teams[winningTeamIndex].overseasCount = (state.teams[winningTeamIndex].overseasCount || 0) + 1;
            }
            if (!state.teams[winningTeamIndex].playersAcquired) {
                state.teams[winningTeamIndex].playersAcquired = [];
            }
            state.teams[winningTeamIndex].playersAcquired.push({
                player: player._id,
                name: playerName,
                role: player.role,
                nationality: player.nationality,
                isOverseas: player.isOverseas,
                boughtFor: state.currentBid.amount,
                basePrice: player.basePrice,
                photoUrl: player.photoUrl,
                imagepath: player.imagepath,
                image_path: player.image_path,
                age: player.age,
                isU23: player.isU23,
                poolID: player.poolID,
                poolName: player.poolName,
                timestamp: new Date().toISOString()
            });
            winningSocketId = state.teams[winningTeamIndex].ownerSocketId;
        }

        // --- Structured JSON Logging for Backend ---
        const soldData = {
            event: "PLAYER_SOLD",
            timestamp: new Date().toISOString(),
            player: {
                id: player._id,
                name: playerName,
                basePrice: player.basePrice
            },
            winningBid: {
                amount: state.currentBid.amount,
                team: state.currentBid.teamName,
                owner: state.currentBid.ownerName
            }
        };
        console.log(JSON.stringify(soldData, null, 2));

        io.to(roomCode).emit('player_sold', {
            player: {
                _id: player._id,
                playerId: player.playerId,
                name: playerName,
                role: player.role,
                nationality: player.nationality,
                isOverseas: player.isOverseas,
                basePrice: player.basePrice,
                photoUrl: player.photoUrl,
                imagepath: player.imagepath,
                image_path: player.image_path,
                poolName: player.poolName
            },
            winningBid: state.currentBid,
            teams: lightweightTeams(state.teams, state.league)
        });

        // Persist Transaction Record
        try {
            await AuctionTransaction.findOneAndUpdate(
                { roomId: roomCode, playerId: player._id },
                {
                    $set: {
                        soldPrice: state.currentBid.amount,
                        soldToTeamId: state.currentBid.teamId,
                        soldToSocketId: winningSocketId,
                        status: 'sold'
                    },
                    $push: {
                        bidHistory: {
                            bidderTeamId: state.currentBid.teamId,
                            bidAmount: state.currentBid.amount
                        }
                    }
                },
                { upsert: true, returnDocument: 'after' }
            );

            // Flush any pending dirty writes first, then persist the sold event atomically
            await flushRoom(roomCode);

            // Update Authoritative Room State
            await AuctionRoom.findOneAndUpdate({ roomId: roomCode }, {
                $set: { franchisesInRoom: state.teams, currentPlayerIndex: state.currentIndex + 1 },
                $pull: { unsoldPlayers: player._id }
            });

            // CHECK: Auto-stop if every team has 25 players
            // ensure there is at least one team before treating this as "full" otherwise
            // an empty array would return true and immediately transition to selection
            const maxSquad = state.league === 'wpl' ? 18 : (state.league === 'sa20' ? 19 : 25);
            const ALL_SQUADS_FULL = state.teams.length > 0 && state.teams.every(t => (t.playersAcquired?.length || 0) >= maxSquad);
            if (ALL_SQUADS_FULL) {
                console.log(`\n--- ALL SQUADS FULL (${maxSquad} players each) in Room ${roomCode} ---`);
                handleAuctionEndTransition(roomCode, io);
                return; // Stop further processing for this player
            }
        } catch (err) {
            console.error("Critical DB Persistence Error on SOLD:", err.message);
        }

    } else {
        state.status = 'Unsold'; // Temporarily pause
        // Player Unsold
        if (!state.unsoldHistory) state.unsoldHistory = [];
        const playerHistoryKey = player._id || player.playerId || player.name || player.player;
        if (!state.unsoldHistory.some((entry) => (entry._id || entry.playerId || entry.name || entry.player) === playerHistoryKey)) {
            state.unsoldHistory.push(player);
        }
        io.to(roomCode).emit('player_unsold', { player, unsoldHistory: state.unsoldHistory });

        try {
            await AuctionTransaction.findOneAndUpdate(
                { roomId: roomCode, playerId: player._id },
                {
                    $set: { status: 'unsold' }
                },
                { upsert: true, returnDocument: 'after' }
            );
            await AuctionRoom.findOneAndUpdate({ roomId: roomCode }, {
                $set: { currentPlayerIndex: state.currentIndex + 1 }
            });
        } catch (err) {
            console.error("Critical DB Persistence Error on UNSOLD:", err.message);
        }
    }

    state.currentIndex += 1;
 
     // Wait for specified delay before advancing podium
     if (nextPlayerDelay > 0) {
        setTimeout(() => {
            loadNextPlayer(roomCode, io);
        }, nextPlayerDelay);
     } else {
        loadNextPlayer(roomCode, io);
     }
 }

function getMinReservePerPlayer(startPurse) {
    if (startPurse <= 500) {
        return 1.75; // SA20 minimum bid
    } else if (startPurse <= 2000) {
        return 10; // WPL minimum bid
    } else {
        return 35; // IPL minimum bid
    }
}

/**
 * isBotOverBudget - Enforces the 80/20 rule: 80% of purse for first 10 players.
 */
function isBotOverBudget(bot, nextBid) {
    const startPurse = bot.startingPurse || 12000;
    const currentPurse = bot.currentPurse || 0;
    const spentPurse = startPurse - (currentPurse - nextBid); // Include this bid
    const squadSize = (bot.playersAcquired?.length || 0);
    
    // [RULE] Max 80% of purse for first 10 players
    const maxSpentForFirst10 = startPurse * 0.8;
    if (squadSize < 10 && spentPurse > maxSpentForFirst10) {
        return true;
    }
    
    // [RULE] Extreme conservation if nearing budget exhaustion
    const remainingNeeded = Math.max(0, 18 - squadSize);
    const minReserve = getMinReservePerPlayer(startPurse);
    const reserveNeeded = remainingNeeded * minReserve * 1.2; 
    if ((currentPurse - nextBid) < reserveNeeded) {
        return true;
    }
    
    return false;
}

/**
 * isBotSustainable - Checks if a bot can afford to buy the current player
 * AND still have enough purse left to reach the minimum of 18 players
 */
function isBotSustainable(bot, nextBid) {
    const startPurse = bot.startingPurse || 12000;
    const currentCount = bot.playersAcquired?.length || 0;
    const targetMin = startPurse <= 500 ? 17 : (startPurse <= 2000 ? 15 : 18);
    const remainingNeeded = Math.max(0, targetMin - (currentCount + 1));
    const minReserve = getMinReservePerPlayer(startPurse);
    const neededReserve = remainingNeeded * minReserve; 
    const canAfford = (bot.currentPurse - nextBid) >= neededReserve;
    
    if (!canAfford && bot.isBot) {
        console.log(`[BOT-GUARD] ${bot.ownerName} sustainability refusal. Purse: ${bot.currentPurse}L, Bid: ${nextBid}L, Reserve for ${remainingNeeded} more: ${neededReserve}L`);
    }
    
    return canAfford;
}

module.exports = {
    setupSocketHandlers,
    rehydrateRoomState,
    resumeAuction
};
