const { ObjectId } = require('mongodb');
const { getCollectionsForLeague } = require('./playerNormalizer');

const SYSTEM_COLLECTIONS = new Set([
    'admins', 'ipl_data', 'wpl_data', 'sa20_data',
    'auctionrooms', 'auctiontransactions', 'franchises',
    'rooms', 'activerooms', 'completedrooms', '_metadata',
]);

const resolveDbName = (dbName) => {
    const key = String(dbName || 'ipl').toLowerCase();
    if (key === 'sa20') return 'SA20';
    return key;
};

const resolveLeague = (dbName) => {
    const key = String(dbName || 'ipl').toLowerCase();
    if (key === 'sa20') return 'sa20';
    if (key === 'wpl') return 'wpl';
    return 'ipl';
};

const getMasterCollection = (league) => (league === 'ipl' ? 'ipl_data' : null);

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildPlayerSearchFilter = (q) => {
    const term = String(q || '').trim();
    if (!term) return null;
    const regex = { $regex: escapeRegex(term), $options: 'i' };
    return {
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
            { Country: regex },
            { country: regex },
            { Role: regex },
            { Specialism: regex },
        ],
    };
};

const buildPlayerIdQuery = (playerId) => {
    let raw = playerId;
    if (typeof playerId === 'string') {
        const trimmed = playerId.trim();
        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            raw = trimmed.slice(1, -1);
        }
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.$oid) raw = parsed.$oid;
            } catch {}
        }
    } else if (typeof playerId === 'object' && playerId !== null && playerId.$oid) {
        raw = playerId.$oid;
    }

    const idStr = String(raw).trim();
    const query = {
        $or: [
            { playerId: idStr },
            { id: idStr },
            { _id: idStr },
        ],
    };
    const num = Number(idStr);
    if (!Number.isNaN(num)) {
        query.$or.push({ id: num }, { playerId: num }, { _id: num });
    }
    if (ObjectId.isValid(idStr)) {
        try {
            query.$or.push({ _id: new ObjectId(idStr) });
        } catch {}
    }
    return query;
};

const getPlayerDisplayName = (p) =>
    p.name || p.player || p.Player ||
    [p['First Name'] || p.First_Name || p.firstName, p.Surname || p.surname]
        .filter(Boolean).join(' ').trim() || '';

const dedupePlayerResults = (players) => {
    const seen = new Map();
    for (const p of players) {
        const nameKey = getPlayerDisplayName(p).toLowerCase();
        const idKey = p.playerId != null ? `pid:${String(p.playerId)}` :
            p.id != null ? `id:${String(p.id)}` :
            p._id != null ? `oid:${String(p._id)}` : null;
        const key = idKey || (nameKey ? `name:${nameKey}` : null);
        if (!key) continue;

        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, p);
            continue;
        }
        // Prefer the entry that has a poolName tag when merging duplicates
        if (!existing.poolName && p.poolName) seen.set(key, p);
    }
    return Array.from(seen.values());
};

const listPlayerCollections = async (db, league) => {
    const listed = (await db.db.listCollections().toArray()).map((c) => c.name);
    const expected = getCollectionsForLeague(league);
    const master = getMasterCollection(league);

    const pools = expected.filter((c) => listed.includes(c));
    if (master && listed.includes(master) && !pools.includes(master)) {
        pools.unshift(master);
    }
    return pools.length ? pools : listed.filter((c) => !SYSTEM_COLLECTIONS.has(c));
};

const countLeaguePlayers = async (db, league) => {
    const colls = await listPlayerCollections(db, league);
    let total = 0;
    for (const coll of colls) {
        total += await db.collection(coll).countDocuments();
    }
    return total;
};

module.exports = {
    SYSTEM_COLLECTIONS,
    resolveDbName,
    resolveLeague,
    getMasterCollection,
    escapeRegex,
    buildPlayerSearchFilter,
    buildPlayerIdQuery,
    dedupePlayerResults,
    listPlayerCollections,
    countLeaguePlayers,
    getPlayerDisplayName,
};
