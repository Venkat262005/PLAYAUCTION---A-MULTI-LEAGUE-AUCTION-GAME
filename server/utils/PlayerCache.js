/**
 * PlayerCache.js
 * High-performance, memory-resident player database.
 * Loaded once at startup to avoid repeated DB pulls or O(N) scans.
 */
const mongoose = require('mongoose');

const COLLECTIONS = [
    'marquee_batters',
    'marquee_bowlers',
    'marquee_allrounders',
    'marquee_wicketkeepers',
    'pool1_batters',
    'pool1_bowlers',
    'pool1_allrounders',
    'pool1_wicketkeepers',
    'Emerging_players',
    'pool2_batters',
    'pool2_bowlers',
    'pool2_allrounders',
    'pool2_wicketkeepers',
    'pool3_batters',
    'pool3_allrounders'
];

const { normalizePlayer } = require('./playerNormalizer');

class PlayerCache {
    constructor() {
        this.playersMap = new Map(); // id -> player object
        this.pools = {}; // dbName_poolName -> array of playerIds
        this.isLoaded = false;
        this.lowestBasePrice = 100000; // Infinity proxy
    }

    async load() {
        if (this.isLoaded) return;

        try {
            console.log('[PlayerCache] Pre-loading all player pools into memory...');
            
            if (!mongoose.connection || !mongoose.connection.client) {
                throw new Error('Mongoose connection not established');
            }

            const { getCollectionsForLeague } = require('./playerNormalizer');
            const dbs = ['ipl', 'wpl', 'sa20'];
            
            for (const dbName of dbs) {
                const targetDb = dbName === 'sa20' ? 'SA20' : dbName;
                const db = mongoose.connection.client.db(targetDb);
                
                // Retrieve actual collections existing in database to avoid throwing error on empty DBs
                let collectionsList = [];
                try {
                    collectionsList = await db.listCollections().toArray();
                } catch (e) {
                    console.log(`[PlayerCache] Could not list collections for ${dbName}:`, e.message);
                    continue;
                }
                
                const existingColls = collectionsList.map(c => c.name);
                const collectionsToUse = getCollectionsForLeague(dbName);
                const collsToLoad = collectionsToUse.filter(c => existingColls.includes(c));
                
                if (collsToLoad.length === 0) {
                    console.log(`[PlayerCache] No matching pool collections found in database: ${dbName}`);
                    continue;
                }

                console.log(`[PlayerCache] Loading ${collsToLoad.length} pools from database: ${dbName}...`);
                const tasks = collsToLoad.map(async (collName) => {
                    const rawPlayers = await db.collection(collName).find({}).toArray();
                    const key = `${dbName}_${collName}`;
                    this.pools[key] = [];

                    rawPlayers.forEach(p => {
                        const player = normalizePlayer(p, collName);
                        const id = String(player._id || p._id);

                        this.playersMap.set(id, player);
                        this.pools[key].push(id);

                        if (player.basePrice < this.lowestBasePrice) {
                            this.lowestBasePrice = player.basePrice;
                        }
                    });
                });

                await Promise.all(tasks);
            }

            this.isLoaded = true;
            console.log(`[PlayerCache] Loaded ${this.playersMap.size} players across active database registries.`);
        } catch (err) {
            console.error('[PlayerCache] Failed to load:', err.message);
            throw err; // Re-throw to be caught by index.js
        }
    }

    getPlayer(id) {
        return this.playersMap.get(typeof id === 'string' ? id : String(id));
    }

    /**
     * getPlayerWithData
     * Synchronous lookup for a player by ID.
     */
    getPlayerWithData(id) {
        return this.getPlayer(id);
    }

    getPool(name, league = 'ipl') {
        const key = `${league}_${name}`;
        return this.pools[key] || this.pools[name] || [];
    }

    updatePlayer(id, updatedData) {
        const existing = this.playersMap.get(String(id));
        if (existing) {
            this.playersMap.set(String(id), { ...existing, ...updatedData });
            console.log(`[PlayerCache] Live update applied to memory for player: ${id}`);
        }
    }

    addPlayer(player, poolName) {
        const id = String(player._id || player.id || player.playerId);
        const { normalizePlayer } = require('./playerNormalizer');
        const normalized = normalizePlayer(player, poolName || 'ipl_data');
        this.playersMap.set(id, normalized);
        
        const targetPool = poolName || 'ipl_data';
        if (!this.pools[targetPool]) this.pools[targetPool] = [];
        if (!this.pools[targetPool].includes(id)) {
            this.pools[targetPool].push(id);
        }
        if (normalized.basePrice < this.lowestBasePrice) {
            this.lowestBasePrice = normalized.basePrice;
        }
        console.log(`[PlayerCache] Live add applied to memory for player: ${id} in pool: ${targetPool}`);
    }

    deletePlayer(id, poolName) {
        const idStr = String(id);
        this.playersMap.delete(idStr);
        if (poolName && this.pools[poolName]) {
            this.pools[poolName] = this.pools[poolName].filter(pid => String(pid) !== idStr);
        } else {
            // Remove from all pools
            for (const pName in this.pools) {
                this.pools[pName] = this.pools[pName].filter(pid => String(pid) !== idStr);
            }
        }
        console.log(`[PlayerCache] Live delete applied to memory for player: ${idStr}`);
    }

    getAllPoolsOrder() {
        return COLLECTIONS;
    }
}

module.exports = new PlayerCache();
