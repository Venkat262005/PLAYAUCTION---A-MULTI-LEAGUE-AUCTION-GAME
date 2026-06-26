/**
 * Validation.js
 * Strict server-side validation. Never trust the client.
 */

const { getRequiredBid, snapBidForLeague } = require('./bidRules');

const validateBid = (state, team, amount) => {
    if (!state || state.status !== 'Auctioning') {
        return { valid: false, error: 'Auction is not active' };
    }

    if (!team) {
        return { valid: false, error: 'You are not assigned to a franchise' };
    }

    // 1. Current Bidder Check
    if (state.currentBid.teamId === team.franchiseId) {
        return { valid: false, error: 'You already hold the highest bid' };
    }

    // 2. Increment Logic (Re-calculated on server)
    const currentPlayer = state.players[state.currentIndex];
    const curAmt = state.currentBid.amount;
    const basePrice = currentPlayer.basePrice || 20;
    const requiredBid = getRequiredBid(curAmt, basePrice, currentPlayer.poolID || '', state.league);
    const bidAmount = snapBidForLeague(amount, state.league);

    // 3. Amount Integrity
    if (bidAmount < requiredBid) {
        return { valid: false, error: `Minimum bid is ${requiredBid}L` };
    }

    // 4. Financial Guard
    if (bidAmount > team.currentPurse) {
        return { valid: false, error: 'Insufficient purse limit' };
    }

    // 4a. Trolling/Overflow Guard
    if (bidAmount > 5000) { // No single player is worth 50cr in this economy
        return { valid: false, error: 'Bid amount exceeds realistic limit' };
    }

    // 5. Squad Limit Guard
    const maxSquad = state && state.league === 'wpl' ? 18 : (state && state.league === 'sa20' ? 19 : 25);
    if (team.playersAcquired.length >= maxSquad) {
        return { valid: false, error: `Squad limit reached (max ${maxSquad})` };
    }

    // 6. Overseas Guard
    const maxOverseas = state && state.league === 'wpl' ? 6 : (state && state.league === 'sa20' ? 7 : 8);
    if (currentPlayer.isOverseas && (team.overseasCount || 0) >= maxOverseas) {
        return { valid: false, error: `Overseas player limit (${maxOverseas}) reached` };
    }

    return { valid: true };
};

const sanitizeString = (str) => {
    return str ? String(str).trim().substring(0, 100) : '';
};

module.exports = { validateBid, sanitizeString };
