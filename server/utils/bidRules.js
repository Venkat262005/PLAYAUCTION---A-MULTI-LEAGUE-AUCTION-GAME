/**
 * Central bid increment + snap rules (server source of truth).
 * Internal amounts are in Lakhs of primary currency (SA20: 1L = R100K).
 */

const snapSa20Bid = (amount) => {
    const n = Number(amount) || 0;
    // 0.25L steps = R25K endings (…00, …25, …50, …75 in thousands)
    return Math.round(n * 4) / 4;
};

const snapWplBid = (amount) => {
    const n = Number(amount) || 0;
    // 0.5L = ₹50K steps → amounts end in .0 or .5 lakhs
    return Math.round(n * 2) / 2;
};

const getMinIncrement = (poolID, currentAmount, league = '') => {
    const lowerPool = (poolID || '').toLowerCase();
    const curAmt = Number(currentAmount) || 0;

    if (league === 'sa20') {
        // R25K increments up to R1M (10L internal), then R50K above
        return curAmt < 10 ? 0.25 : 0.5;
    }

    if (league === 'wpl') {
        if (lowerPool === 'marquee') return 10;
        if (lowerPool === 'uncapped') return 2.5;
        return 5;
    }

    const isWplPool = ['marquee', 'batters', 'wicketkeepers', 'bowlers', 'allrounders', 'uncapped'].includes(lowerPool);
    if (isWplPool) {
        if (lowerPool === 'marquee') return 10;
        if (lowerPool === 'uncapped') return 2.5;
        return 5;
    }

    const isSa20Pool = ['mega', 'elite', 'daimond', 'gold', 'silver', 'domestic'].includes(lowerPool) || lowerPool.startsWith('set_');
    if (isSa20Pool) {
        return curAmt < 10 ? 0.25 : 0.5;
    }

    if (lowerPool.startsWith('marquee') || lowerPool.includes('pool1')) return 25;
    if (lowerPool.includes('emerging')) {
        if (curAmt < 200) return 5;
        if (curAmt < 500) return 10;
        return 25;
    }
    if (lowerPool.includes('pool2') || lowerPool.includes('pool3') || lowerPool.includes('pool4')) {
        return curAmt < 500 ? 10 : 25;
    }
    return 25;
};

const snapBidForLeague = (amount, league) => {
    if (league === 'sa20') return snapSa20Bid(amount);
    if (league === 'wpl') return snapWplBid(amount);
    return Math.round(Number(amount) || 0);
};

const getNextBidAmount = (curAmt, basePrice, poolID, league) => {
    const cur = Number(curAmt) || 0;
    const base = Number(basePrice) || 0;
    const inc = getMinIncrement(poolID, cur, league);
    let next = cur === 0 ? (base > 0 ? base : inc) : cur + inc;
    return snapBidForLeague(next, league);
};

const getRequiredBid = (curAmt, basePrice, poolID, league) =>
    getNextBidAmount(curAmt, basePrice, poolID, league);

module.exports = {
    snapSa20Bid,
    snapWplBid,
    snapBidForLeague,
    getMinIncrement,
    getNextBidAmount,
    getRequiredBid,
};
