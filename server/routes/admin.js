const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Player = require('../models/Player');
const AuctionRoom = require('../models/AuctionRoom');
const Feedback = require('../models/Feedback');
const PlayerCache = require('../utils/PlayerCache');
const {
    resolveDbName,
    resolveLeague,
    getMasterCollection,
    buildPlayerSearchFilter,
    buildPlayerIdQuery,
    dedupePlayerResults,
    listPlayerCollections,
    countLeaguePlayers,
    SYSTEM_COLLECTIONS,
} = require('../utils/adminHelpers');

const JWT_SECRET = process.env.JWT_SECRET || 'ipl_auction_fallback_secret';

// Admin Auth Middleware
const authAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const admin = await Admin.findById(decoded.id);
        if (!admin) return res.status(401).json({ error: 'Unauthorized' });

        req.admin = admin;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Admin Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (!admin || !(await admin.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: admin._id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, username: admin.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Helper to get connection and guarantee .db is populated
const getDb = (dbName) => {
    const targetDb = resolveDbName(dbName);
    const baseConn = Player.db || mongoose.connection;
    const conn = baseConn.useDb(targetDb, { useCache: true });
    if (!conn.db && baseConn.client) {
        conn.db = baseConn.client.db(targetDb);
    }
    return conn;
};

const buildIdQuery = (id) => {
    const query = { $or: [{ _id: id }, { _id: String(id) }] };
    if (ObjectId.isValid(String(id))) query.$or.push({ _id: new ObjectId(String(id)) });
    const num = Number(id);
    if (!Number.isNaN(num)) query.$or.push({ _id: num });
    return query;
};

const parseJsonBody = (raw, label) => {
    if (!raw) return null;
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        throw new Error(`Invalid ${label} JSON`);
    }
};

const maybeSyncPlayerCache = async (dbName, collectionName, action, payload) => {
    const league = resolveLeague(dbName);
    if (league !== 'ipl') return;
    const isPlayerColl = collectionName === 'ipl_data' || PlayerCache.getAllPoolsOrder().includes(collectionName);
    if (!isPlayerColl) return;
    if (action === 'reload') {
        await PlayerCache.load();
        return;
    }
    if (action === 'add' && payload) PlayerCache.addPlayer(payload, collectionName);
    if (action === 'update' && payload) PlayerCache.updatePlayer(payload._id, payload);
    if (action === 'delete' && payload) PlayerCache.deletePlayer(payload, collectionName);
};

// --- DATABASE & COLLECTION CONTROL ---


// List all Databases
router.get('/databases', authAdmin, async (req, res) => {
    try {
        const adminDb = Player.db.db.admin();
        const dbs = await adminDb.listDatabases();
        res.json(dbs.databases.map(db => db.name));
    } catch (err) {
        // Fallback in case listDatabases is restricted or disabled
        res.json(['ipl']);
    }
});

router.get('/feedback', authAdmin, async (req, res) => {
    try {
        const { status, limit = 100 } = req.query;
        const query = {};
        if (status && ['new', 'reviewed', 'resolved'].includes(String(status).toLowerCase())) {
            query.status = String(status).toLowerCase();
        }
        const items = await Feedback.find(query)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit) || 100, 200))
            .lean();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/feedback/:id', authAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};
        if (!['new', 'reviewed', 'resolved'].includes(String(status || '').toLowerCase())) {
            return res.status(400).json({ error: 'Invalid feedback status' });
        }
        const updated = await Feedback.findByIdAndUpdate(
            id,
            { $set: { status: String(status).toLowerCase() } },
            { new: true }
        ).lean();
        if (!updated) return res.status(404).json({ error: 'Feedback not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new Database (Explicit backend control)
router.post('/databases/create', authAdmin, async (req, res) => {
    try {
        const { dbName } = req.body;
        if (!dbName) return res.status(400).json({ error: 'Database name is required' });
        // MongoDB creates a database when the first collection is created.
        const db = getDb(dbName);
        await db.db.createCollection('_metadata');
        res.json({ message: `Database '${dbName}' created and initialized successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Drop Database (Explicit backend control)
router.delete('/databases/drop', authAdmin, async (req, res) => {
    try {
        const { dbName } = req.query;
        if (!dbName) return res.status(400).json({ error: 'Database name is required' });
        if (['admin', 'local', 'config'].includes(dbName.toLowerCase())) {
            return res.status(400).json({ error: 'Cannot drop system databases' });
        }
        const db = getDb(dbName);
        await db.db.dropDatabase();
        res.json({ message: `Database '${dbName}' dropped successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List all Collections in a specific DB
router.get('/collections', authAdmin, async (req, res) => {
    try {
        const { dbName, playerPoolsOnly } = req.query;
        const db = getDb(dbName);
        const collections = (await db.db.listCollections().toArray()).map((c) => c.name);

        if (playerPoolsOnly === 'true') {
            const league = resolveLeague(dbName);
            const pools = await listPlayerCollections(db, league);
            return res.json(pools);
        }

        res.json(collections);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new Collection
router.post('/collections/create', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName } = req.body;
        if (!collectionName) return res.status(400).json({ error: 'Collection name is required' });
        
        // Normalize collection name
        const normalizedCollName = collectionName.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
        if (!normalizedCollName) return res.status(400).json({ error: 'Invalid collection name' });
        
        const db = getDb(dbName || 'ipl');
        try {
            await db.db.createCollection(normalizedCollName);
        } catch (err) {
            // MongoError code 48 is NamespaceExists (collection already exists)
            if (err.code !== 48) {
                throw err;
            }
        }
        res.json({ message: `Collection '${normalizedCollName}' created in database '${dbName || 'ipl'}'`, collectionName: normalizedCollName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Drop Collection
router.delete('/collections/drop', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName } = req.query;
        const db = getDb(dbName || 'ipl');
        await db.db.collection(collectionName).drop();
        res.json({ message: `Collection '${collectionName}' dropped from database '${dbName || 'ipl'}'` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Import Documents (Bulk insert)
router.post('/collections/import', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, documents, overwrite = false } = req.body;
        if (!collectionName) return res.status(400).json({ error: 'Collection name is required' });
        if (!Array.isArray(documents) || documents.length === 0) {
            return res.status(400).json({ error: 'Documents array is required and must not be empty' });
        }
        
        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        
        // 1. If overwrite is true, delete all existing documents in the collection
        if (overwrite) {
            await db.collection(collectionName).deleteMany({});
        }
        
        // 2. Bulk insert documents using insertMany
        const result = await db.collection(collectionName).insertMany(documents);
        
        // 3. Dynamic live sync to PlayerCache if targeting the active ipl database player pools/master
        if (targetDbName === 'ipl') {
            const isPool = PlayerCache.getAllPoolsOrder().includes(collectionName);
            const isMaster = collectionName === 'ipl_data';
            if (isPool || isMaster) {
                // Reload PlayerCache fully to keep real-time engine in perfect sync
                await PlayerCache.load();
                console.log(`[PlayerCache] Bulk import synced. Reloaded all player caches.`);
            }
        }
        
        res.json({ 
            message: `Successfully imported ${result.insertedCount} documents into '${collectionName}'`, 
            insertedCount: result.insertedCount 
        });
    } catch (err) {
        console.error('[Import Error]:', err);
        res.status(500).json({ error: err.message });
    }
});


// --- PLAYER CRUD (Dynamic DB Aware) ---

// Search Players (league-aware, deduplicated)
router.get('/players/search', authAdmin, async (req, res) => {
    try {
        const { q, dbName, collectionName } = req.query;
        if (!q || String(q).trim().length < 2) return res.json([]);

        const league = resolveLeague(dbName);
        const db = getDb(dbName);
        const filter = buildPlayerSearchFilter(q);
        if (!filter) return res.json([]);

        let collectionsToSearch;
        if (collectionName && collectionName !== '__all__') {
            collectionsToSearch = [collectionName];
        } else {
            collectionsToSearch = await listPlayerCollections(db, league);
        }

        const results = [];
        for (const coll of collectionsToSearch) {
            const found = await db.collection(coll).find(filter).limit(25).toArray();
            for (const doc of found) {
                results.push({ ...doc, poolName: coll });
            }
        }

        const players = dedupePlayerResults(results).slice(0, 20);
        res.json(players);
    } catch (err) {
        console.error('[Admin Search Error]:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// Create Player
router.post('/players/create', authAdmin, async (req, res) => {
    try {
        const { player, targetDb, targetCollection } = req.body;
        const league = resolveLeague(targetDb);
        const db = getDb(targetDb);
        const masterColl = getMasterCollection(league);
        const pool = targetCollection || (masterColl || (await listPlayerCollections(db, league))[0]);

        if (!pool) return res.status(400).json({ error: 'No target collection specified' });

        let insertedPlayer = { ...player };

        if (masterColl) {
            const masterRes = await db.collection(masterColl).insertOne(player);
            insertedPlayer = { ...player, _id: masterRes.insertedId };
            if (pool !== masterColl) {
                await db.collection(pool).insertOne(player);
            }
        } else {
            const poolRes = await db.collection(pool).insertOne(player);
            insertedPlayer = { ...player, _id: poolRes.insertedId, poolName: pool };
        }

        if (league === 'ipl') {
            PlayerCache.addPlayer(insertedPlayer, pool);
        }

        res.json({ message: 'Player created successfully', player: insertedPlayer });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Player
router.post('/players/update', authAdmin, async (req, res) => {
    try {
        const { playerId, updates, currentDb, poolName } = req.body;
        const league = resolveLeague(currentDb);
        const db = getDb(currentDb);
        const masterColl = getMasterCollection(league);

        const cleanUpdates = { ...updates };
        delete cleanUpdates._id;
        delete cleanUpdates.id;

        const idQuery = buildPlayerIdQuery(playerId);
        const targetPool = poolName || cleanUpdates.poolName || req.body.targetCollection;

        let updatedDoc = null;

        if (masterColl) {
            const result = await db.collection(masterColl).findOneAndUpdate(
                idQuery,
                { $set: cleanUpdates },
                { returnDocument: 'after' }
            );
            updatedDoc = result?.value ?? result;

            if (targetPool && targetPool !== masterColl) {
                const flattenedUpdates = { ...cleanUpdates };
                if (cleanUpdates.stats) {
                    flattenedUpdates.runs = cleanUpdates.stats.runs;
                    flattenedUpdates.wickets = cleanUpdates.stats.wickets;
                    flattenedUpdates.matches = cleanUpdates.stats.matches;
                    flattenedUpdates.batting_avg = cleanUpdates.stats.battingAvg;
                    flattenedUpdates.batting_strike_rate = cleanUpdates.stats.strikeRate;
                    flattenedUpdates.bowling_economy = cleanUpdates.stats.economy;
                    flattenedUpdates.bowling_avg = cleanUpdates.stats.bowlingAvg;
                    flattenedUpdates.catches = cleanUpdates.stats.catches;
                    flattenedUpdates.stumpings = cleanUpdates.stats.stumpings;
                }
                if (cleanUpdates.name) flattenedUpdates.player = cleanUpdates.name;

                await db.collection(targetPool).updateOne(idQuery, { $set: flattenedUpdates });
            }
        } else if (targetPool) {
            const result = await db.collection(targetPool).findOneAndUpdate(
                idQuery,
                { $set: cleanUpdates },
                { returnDocument: 'after' }
            );
            updatedDoc = result?.value ?? result;
        } else {
            return res.status(400).json({ error: 'poolName is required for this league' });
        }

        if (league === 'ipl' && updatedDoc) {
            PlayerCache.updatePlayer(updatedDoc._id, updatedDoc);
        }

        res.json({ message: 'Player updated successfully', player: updatedDoc });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Player
router.delete('/players/:playerId', authAdmin, async (req, res) => {
    try {
        const { playerId } = req.params;
        const { currentDb, currentCollection } = req.query;
        const league = resolveLeague(currentDb);
        const db = getDb(currentDb);
        const masterColl = getMasterCollection(league);
        const idQuery = buildPlayerIdQuery(playerId);
        const pool = currentCollection || req.query.poolName;

        let playerDoc = null;

        if (masterColl) {
            playerDoc = await db.collection(masterColl).findOne(idQuery);
            await db.collection(masterColl).deleteOne(idQuery);
            if (pool && pool !== masterColl) {
                await db.collection(pool).deleteOne(idQuery);
            }
        } else if (pool) {
            playerDoc = await db.collection(pool).findOne(idQuery);
            await db.collection(pool).deleteOne(idQuery);
        } else {
            return res.status(400).json({ error: 'currentCollection is required for this league' });
        }

        if (league === 'ipl' && playerDoc) {
            PlayerCache.deletePlayer(playerDoc._id, pool || masterColl || 'ipl_data');
        }

        res.json({ message: 'Player deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Move Player
router.post('/players/move', authAdmin, async (req, res) => {
    try {
        const { playerId, fromDb, fromCollection, toDb, toCollection } = req.body;
        const sourceDb = getDb(fromDb);
        const destDb = getDb(toDb || fromDb);
        const idQuery = buildPlayerIdQuery(playerId);

        const playerDoc = await sourceDb.collection(fromCollection).findOne(idQuery);
        if (!playerDoc) return res.status(404).json({ error: 'Player not found in source' });

        const { _id, ...rest } = playerDoc;
        await destDb.collection(toCollection).insertOne(rest);
        await sourceDb.collection(fromCollection).deleteOne(idQuery);

        const league = resolveLeague(fromDb);
        if (league === 'ipl') await PlayerCache.load();

        res.json({ message: `Player moved successfully to ${resolveDbName(toDb || fromDb)}.${toCollection}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Data from a specific Collection (Compass-style: filter, sort, pagination)
router.get('/collections/data', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, limit = 50, skip = 0, page, filter, sort, search } = req.query;
        if (!collectionName) return res.status(400).json({ error: 'collectionName is required' });

        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        const coll = db.collection(collectionName);

        let query = {};
        if (filter) query = parseJsonBody(filter, 'filter') || {};

        if (search && String(search).trim()) {
            const term = String(search).trim();
            const regex = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
            query = {
                $and: [
                    query,
                    {
                        $or: [
                            { name: regex },
                            { player: regex },
                            { Player: regex },
                            { playerId: regex },
                            { id: regex },
                            { 'First Name': regex },
                            { First_Name: regex },
                            { firstName: regex },
                            { Surname: regex },
                            { surname: regex },
                            { teamName: regex },
                            { ownerName: regex },
                            { roomId: regex },
                            { username: regex },
                        ],
                    },
                ],
            };
        }

        let sortObj = { _id: -1 };
        if (sort) sortObj = parseJsonBody(sort, 'sort') || sortObj;

        const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
        const pageNum = parseInt(page, 10);
        const sk = !Number.isNaN(pageNum) && pageNum > 0 ? (pageNum - 1) * lim : (parseInt(skip, 10) || 0);

        const [data, total] = await Promise.all([
            coll.find(query).sort(sortObj).skip(sk).limit(lim).toArray(),
            coll.countDocuments(query),
        ]);

        res.json({ data, total, page: !Number.isNaN(pageNum) ? pageNum : Math.floor(sk / lim) + 1, limit: lim });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Collection metadata (count + sample keys + indexes)
router.get('/collections/stats', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName } = req.query;
        if (!collectionName) return res.status(400).json({ error: 'collectionName is required' });

        const db = getDb(dbName || 'ipl');
        const coll = db.collection(collectionName);
        const [count, indexes, sample] = await Promise.all([
            coll.countDocuments(),
            coll.indexes(),
            coll.findOne({}),
        ]);

        const sampleKeys = sample ? Object.keys(sample) : [];
        res.json({ count, indexes, sampleKeys });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Document (Generic)
router.post('/data/create', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, document } = req.body;
        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        const result = await db.collection(collectionName).insertOne(document);
        const inserted = await db.collection(collectionName).findOne({ _id: result.insertedId });

        await maybeSyncPlayerCache(targetDbName, collectionName, 'add', inserted);

        res.json({ message: 'Document created', id: result.insertedId, document: inserted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Document (Generic $set)
router.put('/data/update', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, id, updates } = req.body;
        if (!collectionName || id === undefined) return res.status(400).json({ error: 'collectionName and id are required' });

        const { _id, id: legacyId, ...cleanUpdates } = updates || {};
        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        const query = buildIdQuery(id);

        const result = await db.collection(collectionName).updateOne(query, { $set: cleanUpdates });
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Document not found' });

        const updatedDoc = await db.collection(collectionName).findOne(query);
        await maybeSyncPlayerCache(targetDbName, collectionName, 'update', updatedDoc);

        res.json({ message: 'Document updated', document: updatedDoc });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Patch Document ($set + $unset) — Compass-style field edits
router.patch('/data/patch', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, id, set = {}, unset = [] } = req.body;
        if (!collectionName || id === undefined) return res.status(400).json({ error: 'collectionName and id are required' });

        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        const query = buildIdQuery(id);
        const update = {};

        if (set && Object.keys(set).length) {
            const clean = { ...set };
            delete clean._id;
            delete clean.id;
            update.$set = clean;
        }
        if (Array.isArray(unset) && unset.length) {
            update.$unset = {};
            unset.forEach((k) => { if (k && k !== '_id') update.$unset[k] = ''; });
        }
        if (!update.$set && !update.$unset) return res.status(400).json({ error: 'Nothing to update' });

        const result = await db.collection(collectionName).updateOne(query, update);
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Document not found' });

        const updatedDoc = await db.collection(collectionName).findOne(query);
        await maybeSyncPlayerCache(targetDbName, collectionName, 'update', updatedDoc);

        res.json({ message: 'Document patched', document: updatedDoc });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Replace entire document (keeps same _id)
router.put('/data/replace', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, id, document } = req.body;
        if (!collectionName || id === undefined || !document) {
            return res.status(400).json({ error: 'collectionName, id, and document are required' });
        }

        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        const query = buildIdQuery(id);
        const existing = await db.collection(collectionName).findOne(query);
        if (!existing) return res.status(404).json({ error: 'Document not found' });

        const { _id: _ignored, ...rest } = document;
        const replacement = { ...rest, _id: existing._id };

        await db.collection(collectionName).replaceOne(query, replacement);
        await maybeSyncPlayerCache(targetDbName, collectionName, 'update', replacement);

        res.json({ message: 'Document replaced', document: replacement });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Duplicate document
router.post('/data/duplicate', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, id } = req.body;
        if (!collectionName || id === undefined) return res.status(400).json({ error: 'collectionName and id are required' });

        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        const query = buildIdQuery(id);
        const doc = await db.collection(collectionName).findOne(query);
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        const { _id, ...copy } = doc;
        const result = await db.collection(collectionName).insertOne({
            ...copy,
            _dupOf: String(_id),
            _dupAt: new Date().toISOString(),
        });

        const inserted = await db.collection(collectionName).findOne({ _id: result.insertedId });
        await maybeSyncPlayerCache(targetDbName, collectionName, 'add', inserted);

        res.json({ message: 'Document duplicated', document: inserted });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk delete documents
router.post('/data/bulk-delete', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, ids } = req.body;
        if (!collectionName || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'collectionName and ids[] are required' });
        }

        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        const objectIds = ids.map((id) => {
            const clauses = buildIdQuery(id).$or;
            return { $or: clauses };
        });

        const result = await db.collection(collectionName).deleteMany({ $or: objectIds.flatMap((q) => q.$or) });
        await maybeSyncPlayerCache(targetDbName, collectionName, 'reload');

        res.json({ message: `Deleted ${result.deletedCount} document(s)`, deletedCount: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Run arbitrary read-only aggregation / find (limited)
router.post('/data/query', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, filter = {}, sort = { _id: -1 }, limit = 50 } = req.body;
        if (!collectionName) return res.status(400).json({ error: 'collectionName is required' });

        const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
        const db = getDb(dbName || 'ipl');
        const data = await db.collection(collectionName).find(filter).sort(sort).limit(lim).toArray();
        const total = await db.collection(collectionName).countDocuments(filter);

        res.json({ data, total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Document (Generic)
router.delete('/data/delete', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, id } = req.query;
        if (!collectionName || id === undefined) return res.status(400).json({ error: 'collectionName and id are required' });

        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        const query = buildIdQuery(id);

        const result = await db.collection(collectionName).deleteOne(query);
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Document not found' });

        await maybeSyncPlayerCache(targetDbName, collectionName, 'delete', id);

        res.json({ message: 'Document deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SYSTEM UTILS ---

// Clear Finished Rooms
router.delete('/rooms/clear-finished', authAdmin, async (req, res) => {
    try {
        const result = await AuctionRoom.deleteMany({ status: 'Finished' });
        res.json({ message: `Cleared ${result.deletedCount} finished rooms` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Stats
router.get('/stats', authAdmin, async (req, res) => {
    try {
        const { dbName } = req.query;
        const league = resolveLeague(dbName);
        const targetDb = getDb(dbName);

        let totalPlayers = 0;
        try {
            totalPlayers = await countLeaguePlayers(targetDb, league);
        } catch {
            totalPlayers = 0;
        }

        const activeRooms = await AuctionRoom.countDocuments({ status: { $ne: 'Finished' } });
        const finishedRooms = await AuctionRoom.countDocuments({ status: 'Finished' });

        res.json({ totalPlayers, activeRooms, finishedRooms, league });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Synchronize Master Registry (IPL only — gather pool data into ipl_data)
router.post('/registry/sync', authAdmin, async (req, res) => {
    try {
        const { dbName } = req.body;
        const league = resolveLeague(dbName);
        if (league !== 'ipl') {
            return res.status(400).json({ error: 'Registry sync is only for IPL (ipl_data master registry)' });
        }

        const db = getDb(dbName);
        const collections = await db.db.listCollections().toArray();
        const poolNames = collections
            .map((c) => c.name)
            .filter((name) => !SYSTEM_COLLECTIONS.has(name));

        let totalSynced = 0;
        for (const pool of poolNames) {
            const players = await db.collection(pool).find({}).toArray();
            for (const p of players) {
                const pid = p.playerId || p.id || `SYNC_${Math.random().toString(36).substr(2, 5)}`;
                const { _id, ...playerData } = p;

                await db.collection('ipl_data').updateOne(
                    { playerId: String(pid) },
                    { $set: { ...playerData, playerId: String(pid), poolName: pool } },
                    { upsert: true }
                );
                totalSynced++;
            }
        }

        await maybeSyncPlayerCache('ipl', 'ipl_data', 'reload');

        res.json({ message: `Registry synchronized. Processed ${totalSynced} players across ${poolNames.length} pools.`, count: totalSynced });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
