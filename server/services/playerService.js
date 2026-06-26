const mongoose = require('mongoose');

/**
 * Unified service to fetch and map players from multiple collections.
 * Handles: 
 * - Waiting for DB connection
 * - Aggregating from all league auction collections dynamically
 */
async function fetchAllPlayers(league = 'ipl') {
    try {
        // Ensure connection is ready
        if (mongoose.connection.readyState !== 1) {
            console.log("[PLAYER_SERVICE] Waiting for MongoDB connection...");
            await new Promise((resolve) => {
                const timer = setInterval(() => {
                    if (mongoose.connection.readyState === 1) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        }

        const targetLeague = ['ipl', 'wpl', 'sa20'].includes(String(league).toLowerCase()) ? String(league).toLowerCase() : 'ipl';
        const { getCollectionsForLeague, normalizePlayer } = require('../utils/playerNormalizer');
        const collections = getCollectionsForLeague(targetLeague);

        let allPlayers = [];
        const db = mongoose.connection.client.db(targetLeague === 'sa20' ? 'SA20' : targetLeague);

        for (const collName of collections) {
            let docs = [];
            try {
                docs = await db.collection(collName).find({}).toArray();
            } catch (e) {
                console.log(`[PLAYER_SERVICE] Collection ${collName} not found in ${targetLeague} DB`);
                continue;
            }

            const mapped = docs.map(doc => normalizePlayer(doc, collName));
            allPlayers = allPlayers.concat(mapped);
        }

        return allPlayers;
    } catch (err) {
        console.error("[PLAYER_SERVICE] Error fetching players:", err);
        return [];
    }
}

module.exports = {
    fetchAllPlayers
};
