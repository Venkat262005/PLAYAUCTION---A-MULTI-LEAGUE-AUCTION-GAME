/**
 * sa20History.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Static SA20 squad data for seasons 2023–2026.
 * Used to power the retention system: when a team creates a room for a given
 * auction year, they can retain up to 4 capped + 1 uncapped player from the
 * PREVIOUS year's squad.
 *
 * SA20 Retention Costs:
 *   Capped:
 *     Slot 1 (best player):  R 9M  = 90 units
 *     Slot 2:                R 7M  = 70 units
 *     Slot 3:                R 4.5M = 45 units
 *     Slot 4:                R 3.5M = 35 units
 *   Uncapped (Domestic pool):
 *     R 500K = 5 units
 *
 * Budget scale: 1 unit = R 100K, total purse = 410 units (R 41M)
 *
 * "Uncapped" = players in the SA20 Domestic pool (not internationally capped
 * for any nation). The DOMESTIC_PLAYERS set below tracks known domestic players
 * across all SA20 seasons.
 */

// ── Known domestic / uncapped players (domestic pool in SA20) ────────────────
// These players were NOT internationally capped at senior level when they
// appeared in SA20. Identified from squad data and SA20 domestic pool records.
const DOMESTIC_PLAYERS = new Set([
    // Season 2023
    'Matthew Breetzke', 'Christiaan Jonker', 'Donovan Ferreira', 'Caleb Seleka',
    'Neil Brand', 'Sibonelo Makhanya', 'Kyle Simmonds', 'Delano Potgieter',
    'Grant Roelofsen', 'Ziyaad Abrahams', 'Wihan Lubbe', 'Evan Jones',
    'Ramon Simmonds', 'Codi Yusuf', 'Marco Marais', 'Shane Dadswell',
    'Eathan Bosch', 'Daryn Dupavillon',
    // Season 2024 additions
    'Bryce Parsons', 'Jason Smith', 'Tony de Zorzi', 'Dayyaan Galiem',
    'Connor Esterhuizen', 'Nealan van Heerden', 'Thomas Kaber',
    'Lhuan-dre Pretorius', 'Keith Dudgeon', 'Nqaba Peter',
    'Steve Stolk', 'Tiaan van Vuuren', 'Matthew Boast',
    // Season 2025 additions
    'CJ King', 'JP King', 'Tristan Luus', 'Sam Hain', 'Rubin Hermann',
    'Dewan Marais', 'Keagan Lion-Cachet',
    // Season 2026 additions
    'Gysbert Wege', 'Dian Forrester', 'Janco Smit', 'Neil Timmers',
    'Shubham Ranjane', 'Rivaldo Moonsamy', 'Dan Lategan', 'Jacques Snyman',
    'Jacob Johannes Basson', 'Nqobani Mokoena', 'Vishen Halambage', 'Thomas Rew',
    'Asa Tribe', 'Gideon Peters', 'Meeka-eel Prince', 'Bayanda Majola',
    'Beyers Swanepoel', 'Patrick Kruger', 'Okuhle Cele', 'James Coles',
]);

// ── Slot-based retention costs for CAPPED players ────────────────────────────
// Index 0 = first retained capped player (most expensive), etc.
const CAPPED_SLOT_COSTS = [90, 70, 45, 35]; // units (1 unit = R 100K)

// Retention cost for a SINGLE uncapped (domestic) player
const UNCAPPED_COST = 5; // 5 units = R 500K

// ── SA20 squad data by season ─────────────────────────────────────────────────
const SA20_SQUADS = {
    '2023': {
        "Durban's Super Giants": [
            'Quinton de Kock', 'Jason Holder', 'Kyle Mayers', 'Reece Topley',
            'Prenelan Subrayen', 'Dwaine Pretorius', 'Heinrich Klaasen', 'Keemo Paul',
            'Keshav Maharaj', 'Kyle Abbott', 'Junior Dala', 'Dilshan Madushanka',
            'Johnson Charles', 'Matthew Breetzke', 'Christiaan Jonker', 'Simon Harmer',
            'Wiaan Mulder', 'Hardus Viljoen', 'Akila Dananjaya', 'Ben McDermott', 'David Willey'
        ],
        'Joburg Super Kings': [
            'Faf du Plessis', 'Moeen Ali', 'Maheesh Theekshana', 'Romario Shepherd',
            'Gerald Coetzee', 'Harry Brook', 'Janneman Malan', 'Reeza Hendricks',
            'Kyle Verreynne', 'George Garton', 'Alzarri Joseph', 'Leus du Plooy',
            'Lewis Gregory', 'Lizaad Williams', 'Nandre Burger', 'Donovan Ferreira',
            'Malusi Siboto', 'Caleb Seleka', 'Aaron Phangiso', 'Neil Brand',
            'Sibonelo Makhanya', 'Matthew Wade', 'Kyle Simmonds'
        ],
        'MI Cape Town': [
            'Rashid Khan', 'Kagiso Rabada', 'Dewald Brevis', 'Sam Curran',
            'Liam Livingstone', 'Rassie van der Dussen', 'Ryan Rickelton', 'George Linde',
            'Beuran Hendricks', 'Duan Jansen', 'Delano Potgieter', 'Odean Smith',
            'Ziyaad Abrahams', 'Wesley Marshall', 'Olly Stone', 'Waqar Salamkheil',
            'Grant Roelofsen', 'Jofra Archer', 'Tim David'
        ],
        'Paarl Royals': [
            'David Miller', 'Jos Buttler', 'Obed McCoy', 'Corbin Bosch', 'Lungi Ngidi',
            'Tabraiz Shamsi', 'Jason Roy', 'Dane Vilas', 'Bjorn Fortuin',
            'Mitchell van Buuren', 'Wihan Lubbe', 'Ferisco Adams', 'Imran Manack',
            'Evan Jones', 'Ramon Simmonds', 'Eoin Morgan', 'Codi Yusuf',
            'Andile Phehlukwayo'
        ],
        'Pretoria Capitals': [
            'Wayne Parnell', 'Anrich Nortje', 'Migael Pretorius', 'Rilee Rossouw',
            'Phil Salt', 'Josh Little', 'Shaun von Berg', 'Adil Rashid',
            'Cameron Delport', 'Will Jacks', 'Theunis de Bruyn', 'Marco Marais',
            'James Neesham', 'Kusal Mendis', 'Daryn Dupavillon', 'Shane Dadswell',
            'Eathan Bosch', 'Senuran Muthusamy', 'Colin Ingram'
        ],
        'Sunrisers Eastern Cape': [
            'Aiden Markram', 'Ottniel Baartman', 'Marco Jansen', 'Tristan Stubbs',
            'Sisanda Magala', 'Junaid Dawood', 'Mason Crane', 'JJ Smuts',
            'Jordan Cox', 'Adam Rossington', 'Roelof van der Merwe', 'Marques Ackerman',
            'James Fuller', 'Brydon Carse', 'Sarel Erwee', 'Ayabulela Gqamane',
            'Tom Abell', 'Jordan Hermann', 'Temba Bavuma'
        ]
    },

    '2024': {
        "Durban's Super Giants": [
            'Quinton de Kock', 'Matthew Breetzke', 'Junior Dala', 'Keshav Maharaj',
            'Heinrich Klaasen', 'Kyle Mayers', 'Wiaan Mulder', 'Bryce Parsons',
            'Keemo Paul', 'Nicholas Pooran', 'Dwaine Pretorius', 'Bhanuka Rajapaksa',
            'Jason Smith', 'JJ Smuts', 'Prenelan Subrayen', 'Reece Topley',
            'Naveen-ul-Haq', 'Kyle Abbott', 'Dilshan Madushanka', 'Noor Ahmad',
            'Tony de Zorzi', 'Richard Gleeson'
        ],
        'Joburg Super Kings': [
            'Faf du Plessis', 'Moeen Ali', 'Nandre Burger', 'Gerald Coetzee',
            'Sam Cook', 'Donovan Ferreira', 'Dayyaan Galiem', 'Reeza Hendricks',
            'Zahir Khan', 'Wayne Madsen', 'Sibonelo Makhanya', 'Aaron Phangiso',
            'Leus du Plooy', 'Romario Shepherd', 'Kyle Simmonds', 'Imran Tahir',
            'David Wiese', 'Lizaad Williams', 'Ronan Hermann'
        ],
        'MI Cape Town': [
            'Kieron Pollard', 'Tom Banton', 'Christopher Benjamin', 'Dewald Brevis',
            'Sam Curran', 'Connor Esterhuizen', 'Beuran Hendricks', 'Duan Jansen',
            'Thomas Kaber', 'George Linde', 'Liam Livingstone', 'Delano Potgieter',
            'Kagiso Rabada', 'Ryan Rickelton', 'Grant Roelofsen', 'Olly Stone',
            'Rassie van der Dussen', 'Nealan van Heerden', 'Rashid Khan',
            'Jofra Archer', 'Nuwan Thushara'
        ],
        'Paarl Royals': [
            'David Miller', 'Ferisco Adams', 'Fabian Allen', 'Jos Buttler',
            'Bjorn Fortuin', 'Evan Jones', 'Wihan Lubbe', 'Obed McCoy',
            'Lungi Ngidi', 'Andile Phehlukwayo', 'Jason Roy', 'Tabraiz Shamsi',
            'Lorcan Tucker', 'John Turner', 'Mitchell van Buuren', 'Dane Vilas',
            'Codi Yusuf', 'Kwena Maphaka', 'Lhuan-dre Pretorius',
            'Keith Dudgeon', 'Nqaba Peter'
        ],
        'Pretoria Capitals': [
            'Wayne Parnell', 'Matthew Boast', 'Eathan Bosch', 'Corbin Bosch',
            'Shane Dadswell', 'Theunis de Bruyn', 'Daryn Dupavillon', 'Colin Ingram',
            'Will Jacks', 'Senuran Muthusamy', 'James Neesham', 'Migael Pretorius',
            'Adil Rashid', 'Rilee Rossouw', 'Phil Salt', 'Paul Stirling',
            'Kyle Verreynne', 'Anrich Nortje', 'Steve Stolk', 'Tiaan van Vuuren',
            'Hardus Viljoen'
        ],
        'Sunrisers Eastern Cape': [
            'Aiden Markram', 'Tom Abell', 'Ottniel Baartman', 'Temba Bavuma',
            'Liam Dawson', 'Sarel Erwee', 'Ayabulela Gqamane', 'Simon Harmer',
            'Jordan Hermann', 'Marco Jansen', 'Dawid Malan', 'Adam Rossington',
            'Caleb Seleka', 'Andile Simelane', 'Tristan Stubbs', 'Beyers Swanepoel',
            'Brydon Carse', 'Sisanda Magala', 'Craig Overton', 'Patrick Kruger',
            'Daniel Worrall'
        ]
    },

    '2025': {
        "Durban's Super Giants": [
            'Keshav Maharaj', 'Noor Ahmad', 'Matthew Breetzke', 'Junior Dala',
            'Quinton de Kock', 'Shamar Joseph', 'Brandon King', 'Heinrich Klaasen',
            'Wiaan Mulder', 'Naveen-ul-Haq', 'Bryce Parsons', 'Dwaine Pretorius',
            'Jason Smith', 'JJ Smuts', 'Marcus Stoinis', 'Prenelan Subrayen',
            'Kane Williamson', 'Chris Woakes', 'CJ King'
        ],
        'Joburg Super Kings': [
            'Faf du Plessis', 'Moeen Ali', 'Jonny Bairstow', 'Doug Bracewell',
            'Beuran Hendricks', 'Gerald Coetzee', 'Devon Conway', 'Leus du Plooy',
            'Donovan Ferreira', 'Evan Jones', 'Wihan Lubbe', 'Sibonelo Makhanya',
            'Tabraiz Shamsi', 'Imran Tahir', 'Maheesh Theekshana', 'David Wiese',
            'Hardus Viljoen', 'JP King', 'Matheesha Pathirana'
        ],
        'MI Cape Town': [
            'Rashid Khan', 'Chris Benjamin', 'Trent Boult', 'Dewald Brevis',
            'Connor Esterhuizen', 'Reeza Hendricks', 'Colin Ingram', 'Thomas Kaber',
            'George Linde', 'Azmatullah Omarzai', 'Dane Piedt', 'Delano Potgieter',
            'Kagiso Rabada', 'Ryan Rickelton', 'Ben Stokes', 'Nuwan Thushara',
            'Rassie van der Dussen', 'Tristan Luus', 'Corbin Bosch', 'Matthew Potts'
        ],
        'Paarl Royals': [
            'David Miller', 'Bjorn Fortuin', 'Dayyaan Galiem', 'Sam Hain',
            'Rubin Hermann', 'Dinesh Karthik', 'Kwena Maphaka', 'Lungi Ngidi',
            'Nqaba Peter', 'Andile Phehlukwayo', 'Lhuan-dre Pretorius', 'Joe Root',
            'Eshan Malinga', 'Mujeeb Ur Rahman', 'Mitchell van Buuren', 'Codi Yusuf',
            'Dewan Marais', 'Dunith Wellalage'
        ],
        'Pretoria Capitals': [
            'Rilee Rossouw', 'Marques Ackerman', 'Eathan Bosch', 'Daryn Dupavillon',
            'Rahmanullah Gurbaz', 'Will Jacks', 'Evin Lewis', 'Senuran Muthusamy',
            'James Neesham', 'Anrich Nortje', 'Migael Pretorius', 'Wayne Parnell',
            'Kyle Simmonds', 'Will Smeed', 'Steve Stolk', 'Tiaan van Vuuren',
            'Kyle Verreynne', 'Keagan Lion-Cachet', 'Liam Livingstone'
        ],
        'Sunrisers Eastern Cape': [
            'Aiden Markram', 'Tom Abell', 'Ottniel Baartman', 'Okuhle Cele',
            'Zak Crawley', 'Liam Dawson', 'Richard Gleeson', 'Simon Harmer',
            'Jordan Hermann', 'Marco Jansen', 'Patrick Kruger', 'Craig Overton',
            'Caleb Seleka', 'Andile Simelane', 'Tristan Stubbs', 'Beyers Swanepoel',
            'Roelof van der Merwe', 'Daniel Smith', 'David Bedingham'
        ]
    },

    '2026': {
        "Durban's Super Giants": [
            'Noor Ahmad', 'Sunil Narine', 'Jos Buttler', 'Heinrich Klaasen',
            'Aiden Markram', 'Kwena Maphaka', 'Devon Conway', 'Gerald Coetzee',
            'David Bedingham', 'Marques Ackerman', 'Eathan Bosch', 'Andile Simelane',
            'Tony de Zorzi', 'Dayyaan Galiem', 'Taijul Islam', 'Evan Jones',
            'Gysbert Wege', 'David Wiese', 'Daryn Dupavillon'
        ],
        'Joburg Super Kings': [
            'Faf du Plessis', 'Richard Gleeson', 'Akeal Hosein', 'James Vince',
            'Donovan Ferreira', 'Wiaan Mulder', 'Nandre Burger', 'Prenelan Subrayen',
            'Dian Forrester', 'Steve Stolk', 'Janco Smit', 'Neil Timmers',
            'Shubham Ranjane', 'Brandon King', 'Rilee Rossouw', 'Rivaldo Moonsamy',
            'Imran Tahir', 'Reece Topley'
        ],
        'MI Cape Town': [
            'Nicholas Pooran', 'Corbin Bosch', 'Trent Boult', 'Rashid Khan',
            'George Linde', 'Kagiso Rabada', 'Rassie van der Dussen', 'Ryan Rickelton',
            'Reeza Hendricks', 'Dwaine Pretorius', 'Tristan Luus', 'Jason Smith',
            'Tom Moores', 'Dane Piedt', 'Tiaan van Vuuren', 'Dan Lategan',
            'Tabraiz Shamsi', 'Karim Janat', 'Jacques Snyman'
        ],
        'Paarl Royals': [
            'Lhuan-dre Pretorius', 'Bjorn Fortuin', 'David Miller', 'Sikandar Raza',
            'Mujeeb Ur Rahman', 'Rubin Hermann', 'Ottniel Baartman', 'Gudakesh Motie',
            'Delano Potgieter', 'Kyle Verreynne', 'Keagan Lion-Cachet', 'Asa Tribe',
            'Hardus Viljoen', 'Jacob Johannes Basson', 'Dan Lawrence', 'Eshan Malinga',
            'Nqobani Mokoena', 'Vishen Halambage', 'Nqaba Peter', 'Thomas Rew'
        ],
        'Pretoria Capitals': [
            'Will Jacks', 'Sherfane Rutherford', 'Andre Russell', 'Keshav Maharaj',
            'Lungi Ngidi', 'Dewald Brevis', 'Lizaad Williams', 'Craig Overton',
            'Saqib Mahmood', 'Codi Yusuf', 'Connor Esterhuizen', 'Bryce Parsons',
            'Gideon Peters', 'Junaid Dawood', 'Will Smeed', 'Meeka-eel Prince',
            'Bayanda Majola', 'Wihan Lubbe', 'Sibonelo Makhanya'
        ],
        'Sunrisers Eastern Cape': [
            'Tristan Stubbs', 'Jonny Bairstow', 'Adam Milne', 'AM Ghazanfar',
            'Marco Jansen', 'Quinton de Kock', 'Matthew Breetzke', 'Anrich Nortje',
            'Senuran Muthusamy', 'Patrick Kruger', 'Lutho Sipamla', 'Mitchell van Buuren',
            'Jordan Hermann', 'Beyers Swanepoel', 'James Coles', 'Chris Wood',
            'Lewis Gregory', 'CJ King', 'JP King'
        ]
    }
};

// ── SA20 team name normalization ─────────────────────────────────────────────
const TEAM_NAME_MAP = {
    "Durban's Super Giants":  "Durban's Super Giants",
    'DSG':                    "Durban's Super Giants",
    'Joburg Super Kings':     'Joburg Super Kings',
    'JSK':                    'Joburg Super Kings',
    'MI Cape Town':           'MI Cape Town',
    'MICT':                   'MI Cape Town',
    'Paarl Royals':           'Paarl Royals',
    'PR':                     'Paarl Royals',
    'Pretoria Capitals':      'Pretoria Capitals',
    'PC':                     'Pretoria Capitals',
    'Sunrisers Eastern Cape': 'Sunrisers Eastern Cape',
    'SEC':                    'Sunrisers Eastern Cape',
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the previous year's squads for the given auction year.
 * For 2023 (first season) returns null — no retentions.
 */
function getSA20PrevSquads(auctionYear) {
    const prevYear = String(Number(auctionYear) - 1);
    return SA20_SQUADS[prevYear] || null;
}

/**
 * Returns the squad for a specific team in a specific season.
 */
function getTeamSquad(teamName, season) {
    const normalized = TEAM_NAME_MAP[teamName] || teamName;
    return (SA20_SQUADS[String(season)] || {})[normalized] || [];
}

/**
 * Returns true if the player is a domestic / uncapped SA20 player.
 * "Uncapped" in SA20 context = player in the Domestic pool.
 */
function isUncappedPlayer(playerName) {
    return DOMESTIC_PLAYERS.has(playerName);
}

/**
 * Calculate the TOTAL purse cost of a retention selection.
 *
 * Capped players are billed by slot order (most expensive slot first).
 * The uncapped player always costs UNCAPPED_COST regardless of order.
 *
 * @param {string[]} cappedPlayers   Up to 4 capped player names (ordered by slot)
 * @param {string|null} uncappedPlayer  Single uncapped player name or null
 * @returns {{ totalCost: number, breakdown: Array<{name,cost,slot,isUncapped}> }}
 */
function calculateRetentionCosts(cappedPlayers = [], uncappedPlayer = null) {
    const breakdown = [];

    cappedPlayers.forEach((name, idx) => {
        const cost = CAPPED_SLOT_COSTS[idx] ?? CAPPED_SLOT_COSTS[CAPPED_SLOT_COSTS.length - 1];
        breakdown.push({ name, cost, slot: idx + 1, isUncapped: false });
    });

    if (uncappedPlayer) {
        breakdown.push({ name: uncappedPlayer, cost: UNCAPPED_COST, slot: null, isUncapped: true });
    }

    const totalCost = breakdown.reduce((sum, p) => sum + p.cost, 0);
    return { totalCost, breakdown };
}

/**
 * Validates a retention selection for a team.
 * Returns { valid: boolean, error?: string }
 *
 * Rules (real SA20):
 *   - All players must be from the previous year's squad
 *   - Max 4 capped players
 *   - Max 1 uncapped (domestic pool) player
 *
 * @param {string} teamName
 * @param {string|number} auctionYear
 * @param {string[]} selectedPlayers   Combined array of all retained players
 */
function validateRetentions(teamName, auctionYear, selectedPlayers) {
    if (!selectedPlayers || selectedPlayers.length === 0) {
        return { valid: true };
    }

    const prevSquad = getTeamSquad(teamName, Number(auctionYear) - 1);
    if (!prevSquad.length) {
        return { valid: false, error: 'No previous season squad found for this team.' };
    }

    const invalidPlayers = selectedPlayers.filter(p => !prevSquad.includes(p));
    if (invalidPlayers.length > 0) {
        return { valid: false, error: `These players were not in your squad: ${invalidPlayers.join(', ')}` };
    }

    const uncapped = selectedPlayers.filter(p => isUncappedPlayer(p));
    const capped   = selectedPlayers.filter(p => !isUncappedPlayer(p));

    if (uncapped.length > 1) {
        return { valid: false, error: 'Maximum 1 uncapped (domestic) player can be retained.' };
    }
    if (capped.length > 4) {
        return { valid: false, error: 'Maximum 4 capped players can be retained.' };
    }

    return { valid: true };
}

module.exports = {
    SA20_SQUADS,
    CAPPED_SLOT_COSTS,
    UNCAPPED_COST,
    TEAM_NAME_MAP,
    getSA20PrevSquads,
    getTeamSquad,
    isUncappedPlayer,
    calculateRetentionCosts,
    validateRetentions,
};
