const { isUncappedPlayer } = require('../services/sa20History');

const isSa20UncappedAcquired = (player) => {
    if (!player) return false;
    if (player.isUncapped === true) return true;
    const pool = String(player.poolID || player.poolName || '').toLowerCase();
    if (pool.includes('domestic')) return true;
    const name = player.name || player.player || '';
    return isUncappedPlayer(name);
};

module.exports = { isSa20UncappedAcquired };
