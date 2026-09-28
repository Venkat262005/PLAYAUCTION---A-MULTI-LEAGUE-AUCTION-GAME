const express = require('express');
const router = express.Router();
require('../models/Franchise');
require('../models/Player');
const AuctionRoom = require('../models/AuctionRoom');
const Feedback = require('../models/Feedback');
const { evaluateAllTeams } = require('../services/aiRating');
const { getTeamLogoUrl } = require('../utils/teamLogos');

router.get('/room/:roomCode', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const room = await AuctionRoom.findOne({ roomId: roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/room/:roomCode/results', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const room = await AuctionRoom.findOne({ roomId: roomCode })
            .populate('franchisesInRoom.franchiseId')
            .populate('franchisesInRoom.playersAcquired.player');

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (room.status !== 'Finished') {
            return res.status(400).json({ error: 'Auction is not finished yet' });
        }

        // Sort teams by overallScore descending and assign rank (1 = best)
        const sorted = [...room.franchisesInRoom].sort((a, b) => {
            const scoreA = a.evaluation?.overallScore ?? 0;
            const scoreB = b.evaluation?.overallScore ?? 0;
            return scoreB - scoreA;
        });

        sorted.forEach((team, i) => {
            team.rank = i + 1;
            const logo = getTeamLogoUrl(team.teamName, room.league);
            team.logoUrl = logo;
            team.teamLogo = logo;

            // Enforce rank-accurate tournament projection
            if (team.evaluation) {
                if (!team.evaluation.tournament_projection) {
                    team.evaluation.tournament_projection = {};
                }
                if (team.rank === 1) {
                    team.evaluation.tournament_projection.projected_finish = "Champions / Finalists";
                } else if (team.rank === 2) {
                    team.evaluation.tournament_projection.projected_finish = "Finalist Contender";
                } else if (team.rank <= 4) {
                    team.evaluation.tournament_projection.projected_finish = "Playoffs Contender (Top 4)";
                } else {
                    team.evaluation.tournament_projection.projected_finish = `${team.rank}th Place (Eliminated)`;
                    team.evaluation.tournament_projection.playoff_probability = "15%";
                }
            }
        });

        res.json({
            teams: sorted,
            league: room.league || 'ipl',
            currency: room.currency || 'inr',
            quizLeaderboard: room.quizLeaderboard || [],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error generating results' });
    }
});

router.post('/room/:roomCode/custom-evaluate', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const { teamName, playingXI, benchReserves } = req.body;

        if (!teamName) {
            return res.status(400).json({ error: 'Team name is required.' });
        }

        if (!Array.isArray(playingXI) || playingXI.length !== 11) {
            return res.status(400).json({ error: 'You must select exactly 11 players for your Starting Playing XI.' });
        }

        const reserves = Array.isArray(benchReserves) ? benchReserves : [];
        if (playingXI.length + reserves.length > 19) {
            return res.status(400).json({ error: 'A maximum of 19 players (11 starters + up to 8 reserves) can be evaluated.' });
        }

        const room = await AuctionRoom.findOne({ roomId: roomCode })
            .populate('franchisesInRoom.franchiseId')
            .populate('franchisesInRoom.playersAcquired.player');

        if (!room) {
            return res.status(404).json({ error: 'Room not found.' });
        }

        const teamIndex = room.franchisesInRoom.findIndex(f => f.teamName === teamName);
        if (teamIndex === -1) {
            return res.status(404).json({ error: `Team ${teamName} not found in this room.` });
        }

        const team = room.franchisesInRoom[teamIndex];
        const squadPlayers = team.playersAcquired || [];
        const squadPlayerNames = squadPlayers.map(p => p.name || p.player?.name || p.player);

        // Verify that all selected players are in the squad roster
        for (const pName of [...playingXI, ...reserves]) {
            if (!squadPlayerNames.includes(pName)) {
                return res.status(400).json({ error: `Player "${pName}" is not in ${teamName}'s squad roster.` });
            }
        }

        const selectedNames = new Set([...playingXI, ...reserves]);
        const evaluatedPlayers = squadPlayers.filter(p => selectedNames.has(p.name || p.player?.name || p.player));

        const { evaluateCustomTeamLineup } = require('../services/aiRating');
        const customResult = await evaluateCustomTeamLineup({
            teamId: team.teamName,
            teamName: team.teamName,
            league: room.league || 'ipl',
            playersAcquired: evaluatedPlayers,
            currentPurse: team.currentPurse,
            customPlayingXI: playingXI,
            customBenchReserves: reserves
        }, room.league || 'ipl');

        // Update the team in MongoDB
        const updatedEvaluation = {
            ...(team.evaluation || {}),
            ...(customResult.evaluation || {}),
            overallScore: customResult.evaluation?.overallScore ?? customResult.evaluation?.rating ?? team.evaluation?.overallScore ?? 75,
            rating: customResult.evaluation?.overallScore ?? customResult.evaluation?.rating ?? team.evaluation?.rating ?? 75,
            customLineupApplied: true,
            customPlayingXI: playingXI,
            customBenchReserves: reserves
        };

        team.evaluation = updatedEvaluation;

        // Update playing11 and impactPlayers on the team
        const findId = (name) => {
            const p = squadPlayers.find(pa => (pa.name || pa.player?.name || pa.player) === name);
            return p ? (p.player?._id || p.player || p._id) : null;
        };
        team.playing11 = playingXI.map(name => findId(name)).filter(Boolean);
        team.impactPlayers = reserves.map(name => findId(name)).filter(Boolean);

        // Re-sort teams and re-rank
        room.franchisesInRoom.sort((a, b) => (b.evaluation?.overallScore || 0) - (a.evaluation?.overallScore || 0));
        room.franchisesInRoom.forEach((t, idx) => {
            t.rank = idx + 1;
            const logo = getTeamLogoUrl(t.teamName, room.league);
            t.logoUrl = logo;
            t.teamLogo = logo;

            if (t.evaluation) {
                if (!t.evaluation.tournament_projection) {
                    t.evaluation.tournament_projection = {};
                }
                if (t.rank === 1) {
                    t.evaluation.tournament_projection.projected_finish = "Champions / Finalists";
                } else if (t.rank === 2) {
                    t.evaluation.tournament_projection.projected_finish = "Finalist Contender";
                } else if (t.rank <= 4) {
                    t.evaluation.tournament_projection.projected_finish = "Playoffs Contender (Top 4)";
                } else {
                    t.evaluation.tournament_projection.projected_finish = `${t.rank}th Place (Eliminated)`;
                    t.evaluation.tournament_projection.playoff_probability = "15%";
                }
            }
        });

        await room.save();

        res.json({
            success: true,
            team: room.franchisesInRoom.find(f => f.teamName === teamName),
            teams: room.franchisesInRoom
        });
    } catch (err) {
        console.error('[CUSTOM EVAL ERROR]:', err);
        res.status(500).json({ error: 'Server error during custom lineup evaluation: ' + err.message });
    }
});

router.get('/players', async (req, res) => {
    try {
        const { league } = req.query;
        const { fetchAllPlayers } = require('../services/playerService');
        const players = await fetchAllPlayers(league);
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/feedback', async (req, res) => {
    try {
        const {
            name,
            userId,
            playerName,
            roomCode,
            league,
            page,
            category,
            message,
            contact,
        } = req.body || {};

        const trimmedMessage = String(message || '').trim();
        if (!trimmedMessage) {
            return res.status(400).json({ error: 'Feedback message is required' });
        }

        const feedback = await Feedback.create({
            name: String(name || playerName || 'Anonymous').trim().slice(0, 80) || 'Anonymous',
            userId: userId || null,
            playerName: playerName || null,
            roomCode: roomCode || null,
            league: ['ipl', 'wpl', 'sa20'].includes(String(league || '').toLowerCase()) ? String(league).toLowerCase() : 'ipl',
            page: String(page || '/').slice(0, 200),
            category: ['bug', 'improvement', 'feature', 'general'].includes(String(category || '').toLowerCase())
                ? String(category).toLowerCase()
                : 'general',
            message: trimmedMessage.slice(0, 2000),
            contact: String(contact || '').trim().slice(0, 120),
            userAgent: String(req.headers['user-agent'] || '').slice(0, 300)
        });

        res.status(201).json({ message: 'Feedback submitted successfully', id: feedback._id });
    } catch (error) {
        console.error('[FEEDBACK] Create failed:', error.message);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

module.exports = router;
