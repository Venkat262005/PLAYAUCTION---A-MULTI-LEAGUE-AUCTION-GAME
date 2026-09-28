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

// Enforces Full Admin privileges (blocks 'editor' role from direct production database mutations)
const requireFullAdmin = (req, res, next) => {
    const role = req.admin?.role || 'editor';
    if (role !== 'admin' && role !== 'superadmin') {
        return res.status(403).json({
            error: 'Permission denied. Editors must stage and submit changes through Change Requests for admin approval.'
        });
    }
    next();
};

// Admin / Editor Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (!admin || !(await admin.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const role = admin.role || 'admin';
        const token = jwt.sign({ id: admin._id, username: admin.username, role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, username: admin.username, role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Current User Profile
router.get('/me', authAdmin, (req, res) => {
    res.json({
        id: req.admin._id,
        username: req.admin.username,
        role: req.admin.role || 'admin'
    });
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

const cleanIdAndEJson = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof ObjectId) return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
        return obj.map(cleanIdAndEJson);
    }
    if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 1 && keys[0] === '$oid' && typeof obj.$oid === 'string') {
            try {
                return new ObjectId(obj.$oid);
            } catch {
                return obj;
            }
        }
        if (keys.length === 1 && keys[0] === '$date') {
            return new Date(obj.$date);
        }
        const cleaned = {};
        for (const k of keys) {
            let val = obj[k];
            if (k === '_id' && typeof val === 'string' && ObjectId.isValid(val)) {
                try {
                    val = new ObjectId(val);
                } catch {}
            }
            cleaned[k] = cleanIdAndEJson(val);
        }
        return cleaned;
    }
    return obj;
};

const buildIdQuery = (id) => {
    let raw = id;
    if (typeof id === 'string') {
        const trimmed = id.trim();
        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            raw = trimmed.slice(1, -1);
        }
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.$oid) raw = parsed.$oid;
            } catch {}
        }
    } else if (typeof id === 'object' && id !== null && id.$oid) {
        raw = id.$oid;
    }

    const rawStr = String(raw).trim();
    const query = { $or: [{ _id: rawStr }] };

    if (ObjectId.isValid(rawStr)) {
        try {
            query.$or.push({ _id: new ObjectId(rawStr) });
        } catch {}
    }

    const num = Number(rawStr);
    if (!Number.isNaN(num)) {
        query.$or.push({ _id: num });
        query.$or.push({ id: num });
        query.$or.push({ playerId: num });
    }

    query.$or.push({ id: rawStr });
    query.$or.push({ playerId: rawStr });
    query.$or.push({ roomId: rawStr });

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
    try {
        const league = resolveLeague(dbName);
        if (league !== 'ipl') return;
        if (action === 'reload') {
            await PlayerCache.load();
            return;
        }
        if (action === 'add' && payload) PlayerCache.addPlayer(payload, collectionName);
        if (action === 'update' && payload) PlayerCache.updatePlayer(payload._id || payload.id || payload.playerId, payload);
        if (action === 'delete' && payload) PlayerCache.deletePlayer(payload, collectionName);
    } catch (e) {
        console.warn('[maybeSyncPlayerCache error]:', e.message);
    }
};

// --- DATABASE & COLLECTION CONTROL ---


// List all Databases
router.get('/databases', authAdmin, async (req, res) => {
    try {
        const adminDb = Player.db.db.admin();
        const dbs = await adminDb.listDatabases();
        const names = dbs.databases.map(db => db.name);
        
        // Ensure our core databases are always visible
        const coreDbs = ['ipl', 'wpl', 'SA20'];
        coreDbs.forEach(db => {
            if (!names.some(n => n.toLowerCase() === db.toLowerCase())) {
                names.push(db);
            }
        });
        res.json(names);
    } catch (err) {
        // Fallback in case listDatabases is restricted or disabled
        res.json(['ipl', 'wpl', 'SA20']);
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
router.post('/databases/create', authAdmin, requireFullAdmin, async (req, res) => {
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
router.delete('/databases/drop', authAdmin, requireFullAdmin, async (req, res) => {
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
router.post('/collections/create', authAdmin, requireFullAdmin, async (req, res) => {
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
router.delete('/collections/drop', authAdmin, requireFullAdmin, async (req, res) => {
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
router.post('/collections/import', authAdmin, requireFullAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, documents, overwrite = false, strategy } = req.body;
        if (!collectionName) return res.status(400).json({ error: 'Collection name is required' });
        if (!Array.isArray(documents) || documents.length === 0) {
            return res.status(400).json({ error: 'Documents array is required and must not be empty' });
        }
        
        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        
        // 1. If overwrite is true or strategy is 'overwrite', delete all existing documents in the collection
        const shouldOverwrite = overwrite === true || strategy === 'overwrite';
        if (shouldOverwrite) {
            await db.collection(collectionName).deleteMany({});
        }
        
        // Clean and convert string _id / EJSON to native ObjectId/Dates
        const cleanedDocs = documents.map(doc => cleanIdAndEJson(doc));
        
        // 2. Bulk insert documents using insertMany
        const result = await db.collection(collectionName).insertMany(cleanedDocs);
        
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
router.post('/players/create', authAdmin, requireFullAdmin, async (req, res) => {
    try {
        const { player, targetDb, targetCollection } = req.body;
        const league = resolveLeague(targetDb);
        const db = getDb(targetDb);
        const masterColl = getMasterCollection(league);
        const pool = targetCollection || (masterColl || (await listPlayerCollections(db, league))[0]);

        if (!pool) return res.status(400).json({ error: 'No target collection specified' });

        const cleanPlayer = cleanIdAndEJson({ ...player });
        if (cleanPlayer.name && !cleanPlayer.player) {
            cleanPlayer.player = cleanPlayer.name;
        }

        // Canonical Image: image_path only
        const imagePath = cleanPlayer.image_path || cleanPlayer.photoUrl || cleanPlayer.imagepath || cleanPlayer.image || cleanPlayer.image_url;
        if (imagePath) cleanPlayer.image_path = imagePath;

        // Canonical Batting Position: batting_position only
        const battingPos = cleanPlayer.batting_position || cleanPlayer['batting position'] || cleanPlayer.position || cleanPlayer.battingPosition;
        if (battingPos) cleanPlayer.batting_position = battingPos;

        // Canonical Bowling Type: bowling_type only
        const bowlingType = cleanPlayer.bowling_type || cleanPlayer['bowling type'] || cleanPlayer.bowlingType;
        if (bowlingType) cleanPlayer.bowling_type = bowlingType;

        // Canonical Batting Style: batting_style only
        const battingStyle = cleanPlayer.batting_style || cleanPlayer['batting style'] || cleanPlayer.battingStyle || cleanPlayer['Batting style'];
        if (battingStyle) cleanPlayer.batting_style = battingStyle;

        // Canonical Bowling Style: bowling_style only
        const bowlingStyle = cleanPlayer.bowling_style || cleanPlayer['bowling style'] || cleanPlayer.bowlingStyle || cleanPlayer['Bowling style'];
        if (bowlingStyle) cleanPlayer.bowling_style = bowlingStyle;

        // Canonical Role: role only
        const role = cleanPlayer.role || cleanPlayer.Role || cleanPlayer.Specialism || cleanPlayer.specialism;
        if (role) cleanPlayer.role = role;

        if (cleanPlayer.stats) {
            cleanPlayer.runs = cleanPlayer.stats.runs;
            cleanPlayer.wickets = cleanPlayer.stats.wickets;
            cleanPlayer.matches = cleanPlayer.stats.matches;
            cleanPlayer.batting_avg = cleanPlayer.stats.battingAvg;
            cleanPlayer.batting_strike_rate = cleanPlayer.stats.strikeRate;
            cleanPlayer.bowling_economy = cleanPlayer.stats.economy;
            cleanPlayer.bowling_avg = cleanPlayer.stats.bowlingAvg;
            cleanPlayer.catches = cleanPlayer.stats.catches;
            cleanPlayer.stumpings = cleanPlayer.stats.stumpings;
        }

        const KEYS_TO_UNSET = {
            image: '', image_url: '', imagepath: '', photoUrl: '',
            position: '', 'batting position': '', battingPosition: '', 'Batting Position': '',
            'batting style': '', battingStyle: '', 'Batting style': '', 'Batting Style': '',
            'bowling type': '', bowlingType: '', 'Bowling type': '', 'Bowling Type': '',
            'bowling style': '', bowlingStyle: '', 'Bowling style': '', 'Bowling Style': '',
            Role: '', Specialism: '', specialism: '', Player: '',
            battingAvg: '', strikeRate: '', highestScore: '', bowlingAvg: '', economy: '', bestFigures: ''
        };

        // Strip duplicate keys from create payload
        for (const k of Object.keys(KEYS_TO_UNSET)) {
            delete cleanPlayer[k];
        }

        let insertedPlayer = { ...cleanPlayer };
        const existingColls = (await db.db.listCollections().toArray()).map((c) => c.name);

        const poolRes = await db.collection(pool).insertOne(cleanPlayer);
        insertedPlayer = { ...cleanPlayer, _id: poolRes.insertedId, poolName: pool };

        if (masterColl && existingColls.includes(masterColl) && pool !== masterColl) {
            await db.collection(masterColl).insertOne(cleanPlayer);
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
router.post('/players/update', authAdmin, requireFullAdmin, async (req, res) => {
    try {
        const { playerId, updates, currentDb, poolName } = req.body;
        const league = resolveLeague(currentDb);
        const db = getDb(currentDb);
        const masterColl = getMasterCollection(league);

        const cleanedUpdates = cleanIdAndEJson({ ...updates });
        delete cleanedUpdates._id;
        delete cleanedUpdates.id;

        if (cleanedUpdates.name && !cleanedUpdates.player) {
            cleanedUpdates.player = cleanedUpdates.name;
        }

        if (cleanedUpdates.role || cleanedUpdates.Role || cleanedUpdates.Specialism || cleanedUpdates.specialism) {
            cleanedUpdates.role = cleanedUpdates.role || cleanedUpdates.Role || cleanedUpdates.Specialism || cleanedUpdates.specialism;
        }

        const imagePath = cleanedUpdates.image_path || cleanedUpdates.photoUrl || cleanedUpdates.imagepath || cleanedUpdates.image || cleanedUpdates.image_url;
        if (imagePath !== undefined) {
            cleanedUpdates.image_path = imagePath;
        }

        const battingPos = cleanedUpdates.batting_position || cleanedUpdates['batting position'] || cleanedUpdates.position || cleanedUpdates.battingPosition;
        if (battingPos !== undefined) {
            cleanedUpdates.batting_position = battingPos;
        }

        const bowlingType = cleanedUpdates.bowling_type || cleanedUpdates['bowling type'] || cleanedUpdates.bowlingType;
        if (bowlingType !== undefined) {
            cleanedUpdates.bowling_type = bowlingType;
        }

        const battingStyle = cleanedUpdates.batting_style || cleanedUpdates['batting style'] || cleanedUpdates.battingStyle || cleanedUpdates['Batting style'];
        if (battingStyle !== undefined) {
            cleanedUpdates.batting_style = battingStyle;
        }

        const bowlingStyle = cleanedUpdates.bowling_style || cleanedUpdates['bowling style'] || cleanedUpdates.bowlingStyle || cleanedUpdates['Bowling style'];
        if (bowlingStyle !== undefined) {
            cleanedUpdates.bowling_style = bowlingStyle;
        }

        if (cleanedUpdates.stats) {
            cleanedUpdates.runs = cleanedUpdates.stats.runs;
            cleanedUpdates.wickets = cleanedUpdates.stats.wickets;
            cleanedUpdates.matches = cleanedUpdates.stats.matches;
            cleanedUpdates.batting_avg = cleanedUpdates.stats.battingAvg;
            cleanedUpdates.batting_strike_rate = cleanedUpdates.stats.strikeRate;
            cleanedUpdates.bowling_economy = cleanedUpdates.stats.economy;
            cleanedUpdates.bowling_avg = cleanedUpdates.stats.bowlingAvg;
            cleanedUpdates.catches = cleanedUpdates.stats.catches;
            cleanedUpdates.stumpings = cleanedUpdates.stats.stumpings;
        }

        const KEYS_TO_UNSET = {
            image: '', image_url: '', imagepath: '', photoUrl: '',
            position: '', 'batting position': '', battingPosition: '', 'Batting Position': '',
            'batting style': '', battingStyle: '', 'Batting style': '', 'Batting Style': '',
            'bowling type': '', bowlingType: '', 'Bowling type': '', 'Bowling Type': '',
            'bowling style': '', bowlingStyle: '', 'Bowling style': '', 'Bowling Style': '',
            Role: '', Specialism: '', specialism: '', Player: '',
            battingAvg: '', strikeRate: '', highestScore: '', bowlingAvg: '', economy: '', bestFigures: ''
        };

        // Strip duplicate keys from $set
        for (const k of Object.keys(KEYS_TO_UNSET)) {
            delete cleanedUpdates[k];
        }

        const updateOperation = {
            $set: cleanedUpdates,
            $unset: KEYS_TO_UNSET
        };

        const idQuery = buildPlayerIdQuery(playerId);
        let rawTargetPool = poolName || cleanedUpdates.poolID || cleanedUpdates.poolName || req.body.targetCollection;
        const targetPool = rawTargetPool ? String(rawTargetPool).toLowerCase().replace(/\s+/g, '_') : null;

        let updatedDoc = null;
        const existingColls = (await db.db.listCollections().toArray()).map((c) => c.name);

        // Update in target collection if exists
        if (targetPool && existingColls.includes(targetPool)) {
            const poolResult = await db.collection(targetPool).findOneAndUpdate(
                idQuery,
                updateOperation,
                { returnDocument: 'after' }
            );
            updatedDoc = poolResult?.value ?? poolResult;
        }

        // Update in master collection if exists
        if (masterColl && existingColls.includes(masterColl) && masterColl !== targetPool) {
            const result = await db.collection(masterColl).findOneAndUpdate(
                idQuery,
                updateOperation,
                { returnDocument: 'after' }
            );
            if (!updatedDoc) {
                updatedDoc = result?.value ?? result;
            }
        }

        // Update in any other player collection where the record exists
        const playerColls = await listPlayerCollections(db, league);
        for (const coll of playerColls) {
            if (coll === targetPool || coll === masterColl) continue;
            const res = await db.collection(coll).findOneAndUpdate(
                idQuery,
                updateOperation,
                { returnDocument: 'after' }
            );
            if (!updatedDoc && (res?.value || res)) {
                updatedDoc = res?.value ?? res;
            }
        }

        if (league === 'ipl' && updatedDoc) {
            PlayerCache.updatePlayer(updatedDoc._id || playerId, updatedDoc);
        }

        res.json({ message: 'Player updated successfully', player: updatedDoc });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Player
router.delete('/players/:playerId', authAdmin, requireFullAdmin, async (req, res) => {
    try {
        const { playerId } = req.params;
        const { currentDb, currentCollection } = req.query;
        const targetDb = resolveDbName(currentDb);
        const league = resolveLeague(targetDb);
        const db = getDb(targetDb);
        const idQuery = buildPlayerIdQuery(playerId);
        const pool = currentCollection || req.query.poolName;

        const existingColls = (await db.db.listCollections().toArray()).map((c) => c.name);
        let playerDoc = null;
        let totalDeleted = 0;
        const deletedFromColls = [];

        // 1. If specific collection is provided and exists, delete from it first
        if (pool && existingColls.includes(pool)) {
            const doc = await db.collection(pool).findOne(idQuery);
            if (doc) {
                playerDoc = doc;
                const delRes = await db.collection(pool).deleteOne(idQuery);
                if (delRes.deletedCount > 0) {
                    totalDeleted += delRes.deletedCount;
                    deletedFromColls.push(pool);
                }
            }
        }

        // 2. Also search all other candidate player collections in this league to delete completely
        const playerColls = await listPlayerCollections(db, league);
        const candidateColls = Array.from(new Set([...playerColls, ...existingColls.filter(c => !SYSTEM_COLLECTIONS.has(c))]));

        for (const collName of candidateColls) {
            if (deletedFromColls.includes(collName)) continue;
            const doc = await db.collection(collName).findOne(idQuery);
            if (doc) {
                if (!playerDoc) playerDoc = doc;
                const delRes = await db.collection(collName).deleteOne(idQuery);
                if (delRes.deletedCount > 0) {
                    totalDeleted += delRes.deletedCount;
                    deletedFromColls.push(collName);
                }
            }
        }

        // 3. If master collection exists, delete from it
        const masterColl = getMasterCollection(league);
        if (masterColl && existingColls.includes(masterColl) && !deletedFromColls.includes(masterColl)) {
            const delRes = await db.collection(masterColl).deleteOne(idQuery);
            if (delRes.deletedCount > 0) {
                totalDeleted += delRes.deletedCount;
                deletedFromColls.push(masterColl);
            }
        }

        // 4. Purge from PlayerCache
        const pIdToDelete = playerDoc?._id || playerId;
        PlayerCache.deletePlayer(pIdToDelete);

        if (totalDeleted === 0) {
            return res.status(404).json({ error: 'Player record not found in database collections' });
        }

        res.json({
            message: `Player permanently deleted (${totalDeleted} record(s) removed from ${deletedFromColls.join(', ')})`,
            deletedCount: totalDeleted,
            collections: deletedFromColls
        });
    } catch (err) {
        console.error('[Admin Delete Player Error]:', err);
        res.status(500).json({ error: err.message });
    }
});

// Move Player
router.post('/players/move', authAdmin, requireFullAdmin, async (req, res) => {
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
        
        const cleanedDoc = cleanIdAndEJson(document);
        const result = await db.collection(collectionName).insertOne(cleanedDoc);
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
        
        const cleanedUpdates = cleanIdAndEJson(cleanUpdates);
        const query = buildIdQuery(id);

        const result = await db.collection(collectionName).updateOne(query, { $set: cleanedUpdates });
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
            update.$set = cleanIdAndEJson(clean);
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
        const replacement = cleanIdAndEJson({ ...rest, _id: existing._id });

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

// Bulk move documents to another collection
router.post('/data/bulk-move', authAdmin, async (req, res) => {
    try {
        const { dbName, sourceCollection, targetCollection, ids } = req.body;
        if (!sourceCollection || !targetCollection || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'sourceCollection, targetCollection, and ids[] are required' });
        }
        if (sourceCollection === targetCollection) {
            return res.status(400).json({ error: 'Source and target collections cannot be the same' });
        }

        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        const objectIds = ids.map((id) => {
            const clauses = buildIdQuery(id).$or;
            return { $or: clauses };
        });

        // 1. Fetch documents from the source collection
        const docs = await db.collection(sourceCollection).find({ $or: objectIds.flatMap((q) => q.$or) }).toArray();
        if (docs.length === 0) {
            return res.status(404).json({ error: 'No matching documents found in source collection' });
        }

        const idsToMove = docs.map(d => d._id);

        // 2. Insert documents into the target collection (prevent duplicate _id issue by deleting any existing first)
        await db.collection(targetCollection).deleteMany({ _id: { $in: idsToMove } });
        const insertResult = await db.collection(targetCollection).insertMany(docs);

        // 3. Delete documents from the source collection
        const deleteResult = await db.collection(sourceCollection).deleteMany({ _id: { $in: idsToMove } });

        // 4. Update the caches if relevant
        await maybeSyncPlayerCache(targetDbName, sourceCollection, 'reload');
        await maybeSyncPlayerCache(targetDbName, targetCollection, 'reload');

        res.json({
            message: `Successfully moved ${insertResult.insertedCount} document(s) from "${sourceCollection}" to "${targetCollection}"`,
            movedCount: insertResult.insertedCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk update documents (e.g. set fields globally or for specific IDs)
const parseValue = (val, type) => {
    if (val === null || val === undefined) return val;
    if (type === 'number') return val === '' ? null : Number(val);
    if (type === 'boolean') return val === 'true' || val === true;
    return String(val);
};

router.post('/data/bulk-update', authAdmin, async (req, res) => {
    try {
        const { dbName, collectionName, ids, filter, update } = req.body;
        if (!collectionName || !update) {
            return res.status(400).json({ error: 'collectionName and update are required' });
        }

        const targetDbName = dbName || 'ipl';
        const db = getDb(targetDbName);
        
        // Custom split format: { fields: [ { key, type, defaultValue, groupValue }, ... ] }
        if (update.fields && Array.isArray(update.fields)) {
            let modifiedCount = 0;
            let matchedCount = 0;
            const defaultSet = {};
            const groupSet = {};

            for (const f of update.fields) {
                if (!f.key) continue;
                const cleanKey = f.key.trim();
                if (!cleanKey) continue;

                const parsedDefault = f.defaultValue !== undefined && f.defaultValue !== '' ? parseValue(f.defaultValue, f.type) : undefined;
                const parsedGroup = f.groupValue !== undefined && f.groupValue !== '' ? parseValue(f.groupValue, f.type) : undefined;

                if (parsedDefault !== undefined) {
                    defaultSet[cleanKey] = parsedDefault;
                }
                if (parsedGroup !== undefined) {
                    groupSet[cleanKey] = parsedGroup;
                }
            }

            // 1. Set default values for all
            if (Object.keys(defaultSet).length > 0) {
                let defaultFilter = {};
                if (filter) {
                    defaultFilter = cleanIdAndEJson(filter);
                }
                const resDefault = await db.collection(collectionName).updateMany(
                    defaultFilter,
                    { $set: defaultSet }
                );
                modifiedCount += resDefault.modifiedCount;
                matchedCount += resDefault.matchedCount;
            }

            // 2. Set group values for selected
            if (Object.keys(groupSet).length > 0 && Array.isArray(ids) && ids.length > 0) {
                const objectIds = ids.map((id) => {
                    const clauses = buildIdQuery(id).$or;
                    return { $or: clauses };
                });
                const groupFilter = { $or: objectIds.flatMap((q) => q.$or) };
                const resGroup = await db.collection(collectionName).updateMany(
                    groupFilter,
                    { $set: groupSet }
                );
                modifiedCount += resGroup.modifiedCount;
                matchedCount += resGroup.matchedCount;
            }

            await maybeSyncPlayerCache(targetDbName, collectionName, 'reload');

            return res.json({
                message: `Bulk update complete: ${modifiedCount} document(s) updated`,
                matchedCount,
                modifiedCount
            });
        }

        // Custom split format: { key, type, defaultValue, groupValue } (legacy support)
        if (update.key) {
            const { key, type, defaultValue, groupValue } = update;
            const cleanKey = key.trim();
            const parsedDefault = defaultValue !== undefined && defaultValue !== '' ? parseValue(defaultValue, type) : undefined;
            const parsedGroup = groupValue !== undefined && groupValue !== '' ? parseValue(groupValue, type) : undefined;

            let modifiedCount = 0;
            let matchedCount = 0;

            // 1. Set default value for all
            if (parsedDefault !== undefined) {
                let defaultFilter = {};
                if (filter) {
                    defaultFilter = cleanIdAndEJson(filter);
                }
                const resDefault = await db.collection(collectionName).updateMany(
                    defaultFilter,
                    { $set: { [cleanKey]: parsedDefault } }
                );
                modifiedCount += resDefault.modifiedCount;
                matchedCount += resDefault.matchedCount;
            }

            // 2. Set group value for selected
            if (parsedGroup !== undefined && Array.isArray(ids) && ids.length > 0) {
                const objectIds = ids.map((id) => {
                    const clauses = buildIdQuery(id).$or;
                    return { $or: clauses };
                });
                const groupFilter = { $or: objectIds.flatMap((q) => q.$or) };
                const resGroup = await db.collection(collectionName).updateMany(
                    groupFilter,
                    { $set: { [cleanKey]: parsedGroup } }
                );
                modifiedCount += resGroup.modifiedCount;
                matchedCount += resGroup.matchedCount;
            }

            await maybeSyncPlayerCache(targetDbName, collectionName, 'reload');

            return res.json({
                message: `Bulk update complete: ${modifiedCount} document(s) updated`,
                matchedCount,
                modifiedCount
            });
        }

        let finalFilter = {};
        if (Array.isArray(ids) && ids.length > 0) {
            const objectIds = ids.map((id) => {
                const clauses = buildIdQuery(id).$or;
                return { $or: clauses };
            });
            finalFilter = { $or: objectIds.flatMap((q) => q.$or) };
        } else if (filter) {
            finalFilter = cleanIdAndEJson(filter);
        }

        const cleanedUpdate = cleanIdAndEJson(update);
        const result = await db.collection(collectionName).updateMany(finalFilter, cleanedUpdate);
        await maybeSyncPlayerCache(targetDbName, collectionName, 'reload');

        res.json({
            message: `Updated ${result.modifiedCount} document(s)`,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
        });
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

        res.json({ message: 'Document deleted successfully', deletedCount: result.deletedCount });
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

// ==========================================
// STAFF / EDITOR ACCOUNT MANAGEMENT
// ==========================================

// List all staff (Admins and Editors)
router.get('/staff', authAdmin, requireFullAdmin, async (req, res) => {
    try {
        const staff = await Admin.find().select('-password').sort({ createdAt: -1 });
        res.json(staff);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new editor or admin account
router.post('/staff/create', authAdmin, requireFullAdmin, async (req, res) => {
    try {
        const { username, password, role = 'editor' } = req.body;
        if (!username || !username.trim()) {
            return res.status(400).json({ error: 'Username is required' });
        }
        if (!password || password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters long' });
        }

        const cleanUsername = username.trim();
        const existing = await Admin.findOne({ username: cleanUsername });
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const validRole = ['admin', 'editor'].includes(role) ? role : 'editor';
        const newStaff = new Admin({
            username: cleanUsername,
            password,
            role: validRole
        });
        await newStaff.save();

        res.status(201).json({
            message: `${validRole === 'admin' ? 'Admin' : 'Editor'} created successfully`,
            user: {
                _id: newStaff._id,
                username: newStaff.username,
                role: newStaff.role,
                createdAt: newStaff.createdAt
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a staff account
router.delete('/staff/:id', authAdmin, requireFullAdmin, async (req, res) => {
    try {
        if (String(req.admin._id) === String(req.params.id)) {
            return res.status(400).json({ error: 'Cannot delete your own active account' });
        }
        const deleted = await Admin.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Staff account not found' });
        res.json({ message: 'Staff member removed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
