/**
 * wplHistory.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Static WPL squad data for seasons 2023–2026.
 * Used to power the retention system: when a team creates a room for a given
 * auction year, they can retain up to 3 capped + 1 uncapped player from the
 * PREVIOUS year's squad.
 *
 * WPL Retention Costs:
 *   Capped:
 *     Slot 1 (best player):  ₹3.50 Cr  = 350 units
 *     Slot 2:                ₹2.50 Cr  = 250 units
 *     Slot 3:                ₹2.50 Cr  = 250 units
 *   Uncapped (Indian domestic, not capped for India Women):
 *     ₹50 Lakh = 50 units
 *
 * Budget scale: 1 unit = ₹1 Lakh, total purse = 1500 units (₹15 Cr)
 *
 * "Uncapped" in WPL = Indian players not internationally capped for India Women.
 * Overseas players (Meg Lanning, Ellyse Perry, etc.) are always "capped".
 */

// ── Known domestic / uncapped Indian WPL players ──────────────────────────────
// Players who were NOT capped for India Women at senior international level
// when they appeared in WPL.
const WPL_DOMESTIC_PLAYERS = new Set([
    // Season 2023
    'Titas Sadhu', 'Jasia Akhtar', 'Minnu Mani', 'Aparna Mondal',
    'Sneha Deepthi', 'Poonam Khemnar', 'Monica Patel', 'Hurley Gala',
    'Ashwani Kumari', 'Parunika Sisodia', 'Shabnam Shakil',
    'Humaira Kazi', 'Jintimani Kalita', 'Neelam Bisht', 'Sonam Yadav',
    'Priyanka Bala', 'Disha Kasat', 'Kanika Ahuja', 'Preeti Bose',
    'Komal Zanzad', 'Sahana Pawar', 'Soppadhandi Yashasri', 'Devika Vaidya',
    'Shivali Shinde', 'Parshavi Chopra', 'Simran Shaikh', 'Laxmi Yadav',
    // Season 2024 additions
    'Trisha Poojitha', 'Priya Mishra', 'Mannat Kashyap', 'Tarannum Pathan',
    'Sayali Satghare', 'Kashvee Gautam', 'Sajeevan Sajana', 'Amandeep Kaur',
    'Fatima Jaffer', 'Keerthana Balakrishnan', 'Shubha Satheesh',
    'Simran Bahadur', 'Ekta Bisht', 'Saima Thakor', 'Gouher Sultana',
    'Vrinda Dinesh',
    // Season 2025 additions
    'Shree Charani', 'Nandini Kashyap', 'Niki Prasad',
    'Prakashika Naik', 'Bharti Fulmali', 'G Kamalini', 'Sanskriti Gupta',
    'Akshita Maheshwari', 'Prema Rawat', 'Alana King',
    // Season 2026 additions
    'Deeya Yadav', 'Mamatha Madiwala', 'Nandni Sharma', 'Shivani Singh',
    'Anushka Sharma', 'Triveni Vasistha', 'Rahila Firdous',
    'Linsey Smith', 'Prathyoosha Kumar', 'Kranti Goud',
]);

// ── Slot-based retention costs for CAPPED players ────────────────────────────
// Index 0 = first retained capped player (most expensive)
const WPL_CAPPED_SLOT_COSTS = [350, 250, 250]; // units (1 unit = ₹1 Lakh)

// Retention cost for a SINGLE uncapped (domestic) player
const WPL_UNCAPPED_COST = 50; // 50 units = ₹50 Lakh

// ── WPL squad data by season ─────────────────────────────────────────────────
const WPL_SQUADS = {
    '2023': {
        'Delhi Capitals': [
            'Meg Lanning', 'Jemimah Rodrigues', 'Shafali Verma', 'Radha Yadav',
            'Shikha Pandey', 'Marizanne Kapp', 'Titas Sadhu', 'Alice Capsey',
            'Tara Norris', 'Laura Harris', 'Jasia Akhtar', 'Minnu Mani',
            'Taniya Bhatia', 'Jess Jonassen', 'Sneha Deepthi', 'Poonam Yadav',
            'Aparna Mondal', 'Arundhati Reddy'
        ],
        'Gujarat Giants': [
            'Beth Mooney', 'Sneh Rana', 'Ashleigh Gardner', 'Sophia Dunkley',
            'Annabel Sutherland', 'Harleen Deol', 'Deandra Dottin', 'Kim Garth',
            'Sabbhineni Meghana', 'Georgia Wareham', 'Mansi Joshi',
            'Dayalan Hemalatha', 'Laura Wolvaardt', 'Tanuja Kanwar',
            'Monica Patel', 'Sushma Verma', 'Hurley Gala', 'Ashwani Kumari',
            'Parunika Sisodia', 'Shabnam Shakil'
        ],
        'Mumbai Indians': [
            'Harmanpreet Kaur', 'Nat Sciver-Brunt', 'Amelia Kerr',
            'Pooja Vastrakar', 'Yastika Bhatia', 'Heather Graham', 'Issy Wong',
            'Amanjot Kaur', 'Dhara Gujjar', 'Saika Ishaque', 'Hayley Matthews',
            'Chloe Tryon', 'Humaira Kazi', 'Priyanka Bala', 'Sonam Yadav',
            'Jintimani Kalita', 'Neelam Bisht'
        ],
        'Royal Challengers Bengaluru': [
            'Smriti Mandhana', 'Sophie Devine', 'Ellyse Perry', 'Renuka Singh',
            'Richa Ghosh', 'Erin Burns', 'Disha Kasat', 'Indrani Roy',
            'Shreyanka Patil', 'Kanika Ahuja', 'Asha Shobana', 'Heather Knight',
            'Dane van Niekerk', 'Preeti Bose', 'Poonam Khemnar', 'Komal Zanzad',
            'Megan Schutt', 'Sahana Pawar'
        ],
        'UP Warriorz': [
            'Alyssa Healy', 'Deepti Sharma', 'Sophie Ecclestone', 'Tahlia McGrath',
            'Shabnim Ismail', 'Anjali Sarvani', 'Rajeshwari Gayakwad',
            'Parshavi Chopra', 'Shweta Sehrawat', 'Soppadhandi Yashasri',
            'Kiran Navgire', 'Grace Harris', 'Devika Vaidya', 'Lauren Bell',
            'Laxmi Yadav', 'Simran Shaikh', 'Shivali Shinde'
        ]
    },

    '2024': {
        'Delhi Capitals': [
            'Meg Lanning', 'Alice Capsey', 'Arundhati Reddy', 'Jemimah Rodrigues',
            'Jess Jonassen', 'Laura Harris', 'Marizanne Kapp', 'Minnu Mani',
            'Poonam Yadav', 'Radha Yadav', 'Shafali Verma', 'Shikha Pandey',
            'Sneha Deepthi', 'Taniya Bhatia', 'Titas Sadhu', 'Annabel Sutherland',
            'Aparna Mondal', 'Ashwani Kumari'
        ],
        'Gujarat Giants': [
            'Ashleigh Gardner', 'Beth Mooney', 'Dayalan Hemalatha', 'Harleen Deol',
            'Laura Wolvaardt', 'Shabnam Shakil', 'Sneh Rana', 'Tanuja Kanwar',
            'Phoebe Litchfield', 'Meghna Singh', 'Trisha Poojitha', 'Priya Mishra',
            'Kathryn Bryce', 'Mannat Kashyap', 'Tarannum Pathan', 'Sayali Satghare',
            'Kashvee Gautam'
        ],
        'Mumbai Indians': [
            'Harmanpreet Kaur', 'Amanjot Kaur', 'Amelia Kerr', 'Chloe Tryon',
            'Hayley Matthews', 'Humaira Kazi', 'Issy Wong', 'Jintimani Kalita',
            'Nat Sciver-Brunt', 'Pooja Vastrakar', 'Priyanka Bala', 'Saika Ishaque',
            'Yastika Bhatia', 'Shabnim Ismail', 'Sajeevan Sajana', 'Amandeep Kaur',
            'Fatima Jaffer', 'Keerthana Balakrishnan'
        ],
        'Royal Challengers Bengaluru': [
            'Smriti Mandhana', 'Asha Shobana', 'Disha Kasat', 'Ellyse Perry',
            'Indrani Roy', 'Renuka Singh', 'Richa Ghosh', 'Shreyanka Patil',
            'Sophie Devine', 'Georgia Wareham', 'Ekta Bisht', 'Kate Cross',
            'Shubha Satheesh', 'Sabbhineni Meghana', 'Simran Bahadur',
            'Sophie Molineux'
        ],
        'UP Warriorz': [
            'Alyssa Healy', 'Anjali Sarvani', 'Deepti Sharma', 'Grace Harris',
            'Kiran Navgire', 'Lauren Bell', 'Laxmi Yadav', 'Parshavi Chopra',
            'Rajeshwari Gayakwad', 'Soppadhandi Yashasri', 'Shweta Sehrawat',
            'Sophie Ecclestone', 'Tahlia McGrath', 'Dani Wyatt', 'Vrinda Dinesh',
            'Saima Thakor', 'Poonam Khemnar', 'Gouher Sultana'
        ]
    },

    '2025': {
        'Delhi Capitals': [
            'Jemimah Rodrigues', 'Meg Lanning', 'Shafali Verma', 'Sneha Deepthi',
            'Alice Capsey', 'Annabel Sutherland', 'Jess Jonassen', 'Arundhati Reddy',
            'Marizanne Kapp', 'Minnu Mani', 'Radha Yadav', 'Shikha Pandey',
            'Taniya Bhatia', 'Titas Sadhu', 'Shree Charani', 'Nandini Kashyap',
            'Sarah Bryce', 'Niki Prasad'
        ],
        'Gujarat Giants': [
            'Ashleigh Gardner', 'Beth Mooney', 'Laura Wolvaardt', 'Phoebe Litchfield',
            'Harleen Deol', 'Dayalan Hemalatha', 'Simran Shaikh', 'Deandra Dottin',
            'Tanuja Kanwar', 'Priya Mishra', 'Shabnam Shakil', 'Mannat Kashyap',
            'Meghna Singh', 'Kashvee Gautam', 'Danielle Gibson', 'Prakashika Naik',
            'Bharti Fulmali', 'Sayali Satghare'
        ],
        'Mumbai Indians': [
            'Harmanpreet Kaur', 'Amelia Kerr', 'Nat Sciver-Brunt', 'Hayley Matthews',
            'Amanjot Kaur', 'Saika Ishaque', 'Yastika Bhatia', 'Pooja Vastrakar',
            'Shabnim Ismail', 'Sajeevan Sajana', 'G Kamalini', 'Nadine de Klerk',
            'Sanskriti Gupta', 'Akshita Maheshwari', 'Jintimani Kalita', 'Chloe Tryon'
        ],
        'Royal Challengers Bengaluru': [
            'Smriti Mandhana', 'Ellyse Perry', 'Richa Ghosh', 'Renuka Singh',
            'Shreyanka Patil', 'Georgia Wareham', 'Danni Wyatt-Hodge',
            'Sabbhineni Meghana', 'Kanika Ahuja', 'Asha Shobana', 'Prema Rawat',
            'Arundhati Reddy'
        ],
        'UP Warriorz': [
            'Meg Lanning', 'Deepti Sharma', 'Sophie Ecclestone', 'Grace Harris',
            'Tahlia McGrath', 'Kiran Navgire', 'Shweta Sehrawat', 'Vrinda Dinesh',
            'Anjali Sarvani', 'Rajeshwari Gayakwad', 'Poonam Khemnar', 'Alana King',
            'Harleen Deol', 'Deandra Dottin'
        ]
    },

    '2026': {
        'Delhi Capitals': [
            'Jemimah Rodrigues', 'Shafali Verma', 'Laura Wolvaardt', 'Marizanne Kapp',
            'Chinelle Henry', 'Shree Charani', 'Sneh Rana', 'Minnu Mani',
            'Taniya Bhatia', 'Lizelle Lee', 'Deeya Yadav', 'Mamatha Madiwala',
            'Niki Prasad', 'Nandni Sharma', 'Alana King', 'Lucy Hamilton'
        ],
        'Gujarat Giants': [
            'Ashleigh Gardner', 'Beth Mooney', 'Yastika Bhatia', 'Sophie Devine',
            'Georgia Wareham', 'Kim Garth', 'Renuka Singh', 'Tanuja Kanwar',
            'Harleen Deol', 'Bharti Fulmali', 'Anushka Sharma', 'Danni Wyatt',
            'Kanika Ahuja', 'Kashvee Gautam', 'Rajeshwari Gayakwad', 'Titas Sadhu',
            'Shivani Singh'
        ],
        'Mumbai Indians': [
            'Harmanpreet Kaur', 'Nat Sciver-Brunt', 'Amelia Kerr', 'Hayley Matthews',
            'Amanjot Kaur', 'Shabnim Ismail', 'Saika Ishaque', 'Sajeevan Sajana',
            'G Kamalini', 'Nicola Carey', 'Sanskriti Gupta', 'Poonam Khemnar',
            'Triveni Vasistha', 'Rahila Firdous', 'Milly Illingworth'
        ],
        'Royal Challengers Bengaluru': [
            'Smriti Mandhana', 'Richa Ghosh', 'Shreyanka Patil', 'Ellyse Perry',
            'Georgia Voll', 'Nadine de Klerk', 'Grace Harris', 'Pooja Vastrakar',
            'Arundhati Reddy', 'Radha Yadav', 'Lauren Bell', 'Prema Rawat',
            'Dayalan Hemalatha', 'Linsey Smith', 'Prathyoosha Kumar'
        ],
        'UP Warriorz': [
            'Meg Lanning', 'Deepti Sharma', 'Sophie Ecclestone', 'Phoebe Litchfield',
            'Kiran Navgire', 'Shweta Sehrawat', 'Harleen Deol', 'Deandra Dottin',
            'Shikha Pandey', 'Simran Shaikh', 'Asha Shobana', 'Chloe Tryon',
            'Charli Knott', 'Kranti Goud'
        ]
    }
};

// ── WPL team name normalization ───────────────────────────────────────────────
const WPL_TEAM_NAME_MAP = {
    'Delhi Capitals':             'Delhi Capitals',
    'DC':                         'Delhi Capitals',
    'Gujarat Giants':             'Gujarat Giants',
    'GG':                         'Gujarat Giants',
    'Mumbai Indians':             'Mumbai Indians',
    'MI':                         'Mumbai Indians',
    'Royal Challengers Bengaluru':'Royal Challengers Bengaluru',
    'Royal Challengers Bangalore':'Royal Challengers Bengaluru',
    'RCB':                        'Royal Challengers Bengaluru',
    'UP Warriorz':                'UP Warriorz',
    'UPW':                        'UP Warriorz',
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API — mirrors sa20History API shape exactly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the previous year's squads for the given auction year.
 * For 2023 (first season) returns null — no retentions.
 */
function getWPLPrevSquads(auctionYear) {
    const prevYear = String(Number(auctionYear) - 1);
    return WPL_SQUADS[prevYear] || null;
}

/**
 * Returns the squad for a specific WPL team in a specific season.
 */
function getWPLTeamSquad(teamName, season) {
    const normalized = WPL_TEAM_NAME_MAP[teamName] || teamName;
    return (WPL_SQUADS[String(season)] || {})[normalized] || [];
}

/**
 * Returns true if the player is a domestic / uncapped Indian WPL player.
 * "Uncapped" in WPL = not capped for India Women internationally.
 */
function isWPLUncappedPlayer(playerName) {
    return WPL_DOMESTIC_PLAYERS.has(playerName);
}

/**
 * Calculate the TOTAL purse cost of a WPL retention selection.
 * Capped players billed by slot (most expensive slot first).
 * Uncapped player always costs WPL_UNCAPPED_COST.
 *
 * @param {string[]} cappedPlayers   Up to 4 capped player names (ordered)
 * @param {string|null} uncappedPlayer  Single uncapped player or null
 * @returns {{ totalCost: number, breakdown: Array<{name,cost,slot,isUncapped}> }}
 */
function calculateWPLRetentionCosts(cappedPlayers = [], uncappedPlayer = null) {
    const breakdown = [];

    cappedPlayers.forEach((name, idx) => {
        const cost = WPL_CAPPED_SLOT_COSTS[idx] ?? WPL_CAPPED_SLOT_COSTS[WPL_CAPPED_SLOT_COSTS.length - 1];
        breakdown.push({ name, cost, slot: idx + 1, isUncapped: false });
    });

    if (uncappedPlayer) {
        breakdown.push({ name: uncappedPlayer, cost: WPL_UNCAPPED_COST, slot: null, isUncapped: true });
    }

    const totalCost = breakdown.reduce((sum, p) => sum + p.cost, 0);
    return { totalCost, breakdown };
}

/**
 * Validates a WPL retention selection for a team.
 * Rules: max 4 capped + max 1 uncapped, all from previous year's squad.
 */
function validateWPLRetentions(teamName, auctionYear, selectedPlayers) {
    if (!selectedPlayers || selectedPlayers.length === 0) {
        return { valid: true };
    }

    const prevSquad = getWPLTeamSquad(teamName, Number(auctionYear) - 1);
    if (!prevSquad.length) {
        return { valid: false, error: 'No previous season squad found for this team.' };
    }

    const invalidPlayers = selectedPlayers.filter(p => !prevSquad.includes(p));
    if (invalidPlayers.length > 0) {
        return { valid: false, error: `These players were not in your squad: ${invalidPlayers.join(', ')}` };
    }

    const uncapped = selectedPlayers.filter(p => isWPLUncappedPlayer(p));
    const capped   = selectedPlayers.filter(p => !isWPLUncappedPlayer(p));

    if (uncapped.length > 1) {
        return { valid: false, error: 'Maximum 1 uncapped (domestic) player can be retained.' };
    }
    if (capped.length > 3) {
        return { valid: false, error: 'Maximum 3 capped players can be retained.' };
    }

    return { valid: true };
}

module.exports = {
    WPL_SQUADS,
    WPL_CAPPED_SLOT_COSTS,
    WPL_UNCAPPED_COST,
    WPL_TEAM_NAME_MAP,
    getWPLPrevSquads,
    getWPLTeamSquad,
    isWPLUncappedPlayer,
    calculateWPLRetentionCosts,
    validateWPLRetentions,
};
