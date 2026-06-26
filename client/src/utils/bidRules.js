/** Client mirror of server bidRules — keep in sync with server/utils/bidRules.js */

export const snapSa20Bid = (amount) => {
    const n = Number(amount) || 0;
    return Math.round(n * 4) / 4;
};

export const snapWplBid = (amount) => {
    const n = Number(amount) || 0;
    return Math.round(n * 2) / 2;
};

export const getMinIncrement = (poolID, currentAmount, league = '') => {
    const lowerPool = (poolID || '').toLowerCase();
    const curAmt = Number(currentAmount) || 0;

    if (league === 'sa20') return curAmt < 10 ? 0.25 : 0.5;

    if (league === 'wpl') {
        if (lowerPool === 'marquee') return 10;
        if (lowerPool === 'uncapped') return 2.5;
        return 5;
    }

    if (lowerPool.startsWith('marquee') || lowerPool.includes('pool1') || lowerPool.includes('pool2')) return 25;
    if (lowerPool.includes('emerging') || lowerPool.includes('pool3') || lowerPool.includes('pool4')) {
        return curAmt < 200 ? 5 : 25;
    }
    return 25;
};

export const snapBidForLeague = (amount, league) => {
    if (league === 'sa20') return snapSa20Bid(amount);
    if (league === 'wpl') return snapWplBid(amount);
    return Math.round(Number(amount) || 0);
};

export const getNextBidAmount = (curAmt, basePrice, poolID, league) => {
    const cur = Number(curAmt) || 0;
    const base = Number(basePrice) || 0;
    const inc = getMinIncrement(poolID, cur, league);
    let next = cur === 0 ? (base > 0 ? base : inc) : cur + inc;
    return snapBidForLeague(next, league);
};
