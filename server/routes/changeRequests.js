const express = require('express');
const router = express.Router();
const mongoose = require('express');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const Admin = require('../models/Admin');
const Player = require('../models/Player');
const ChangeRequest = require('../models/ChangeRequest');
const PlayerCache = require('../utils/PlayerCache');
const { computePlayerDiff, checkConcurrentConflict } = require('../utils/diffHelper');
const {
    resolveDbName,
    resolveLeague,
    getMasterCollection,
    buildPlayerIdQuery,
    listPlayerCollections
} = require('../utils/adminHelpers');

const JWT_SECRET = process.env.JWT_SECRET || 'ipl_auction_fallback_secret';

// Staff Auth Middleware (Admin or Editor)
const authStaff = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorized. Token required.' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await Admin.findById(decoded.id);
        if (!user) return res.status(401).json({ error: 'Unauthorized. User not found.' });

        req.admin = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
};

// Admin Only Middleware (Prevents editors from approving or directly mutating)
const requireAdmin = (req, res, next) => {
    const role = req.admin?.role || 'editor';
    if (role !== 'admin' && role !== 'superadmin') {
        return res.status(403).json({
            error: 'Permission denied. Only admins can review or approve change requests.'
        });
    }
    next();
};

// Database helper
const getTargetDb = (dbName) => {
    const targetDb = resolveDbName(dbName);
    const baseConn = Player.db || mongoose.connection;
    const conn = baseConn.useDb(targetDb, { useCache: true });
    if (!conn.db && baseConn.client) {
        conn.db = baseConn.client.db(targetDb);
    }
    return conn;
};

// Helper: Find document in primary DB
const findCurrentPlayerDoc = async (db, collectionName, playerId, docId) => {
    if (!db || !collectionName) return null;
    const coll = db.collection(collectionName);
    let doc = null;

    if (docId && ObjectId.isValid(docId)) {
        try {
            doc = await coll.findOne({ _id: new ObjectId(docId) });
            if (doc) return doc;
        } catch {}
    }

    if (playerId) {
        const query = buildPlayerIdQuery(playerId);
        doc = await coll.findOne(query);
        if (doc) return doc;
    }

    return null;
};

// -------------------------------------------------------------
// 1. STATS: Summary counts for dashboard badges
// -------------------------------------------------------------
router.get('/stats', authStaff, async (req, res) => {
    try {
        const isEditor = req.admin.role === 'editor';
        const pendingCount = await ChangeRequest.countDocuments({ status: 'PENDING_REVIEW' });
        const approvedCount = await ChangeRequest.countDocuments({ status: 'APPROVED' });
        const rejectedCount = await ChangeRequest.countDocuments({ status: 'REJECTED' });

        const myDraftQuery = isEditor 
            ? { submittedBy: req.admin._id, status: 'DRAFT' }
            : { status: 'DRAFT' };
        const draftCount = await ChangeRequest.countDocuments(myDraftQuery);

        res.json({
            pendingCount,
            approvedCount,
            rejectedCount,
            draftCount,
            userRole: req.admin.role || 'admin',
            username: req.admin.username
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 2. ACTIVE DRAFT: Get or create the editor's active draft
// -------------------------------------------------------------
router.get('/active-draft', authStaff, async (req, res) => {
    try {
        let draft = await ChangeRequest.findOne({
            submittedBy: req.admin._id,
            status: 'DRAFT'
        }).sort({ updatedAt: -1 });

        if (!draft) {
            draft = new ChangeRequest({
                title: `Draft Session - ${req.admin.username}`,
                submittedBy: req.admin._id,
                editorUsername: req.admin.username,
                status: 'DRAFT',
                items: []
            });
            await draft.save();
        }

        res.json(draft);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 2.5 WORKSPACES: Consolidated editor workspaces (Active draft + Contribution history)
// -------------------------------------------------------------
router.get('/workspaces', authStaff, async (req, res) => {
    try {
        let staffMembers = await Admin.find().select('-password').lean();

        // If logged-in user is an editor, they only see their own workspace
        if (req.admin.role === 'editor') {
            staffMembers = staffMembers.filter(s => String(s._id) === String(req.admin._id));
        }

        const workspaces = [];

        for (const staff of staffMembers) {
            // Find active draft or pending review
            let activeDraft = await ChangeRequest.findOne({
                submittedBy: staff._id,
                status: { $in: ['DRAFT', 'PENDING_REVIEW'] }
            }).sort({ updatedAt: -1 });

            // Ensure an active draft exists for this workspace
            if (!activeDraft) {
                activeDraft = new ChangeRequest({
                    title: `Draft Session - ${staff.username}`,
                    submittedBy: staff._id,
                    editorUsername: staff.username,
                    status: 'DRAFT',
                    items: []
                });
                await activeDraft.save();
            }

            // Find all approved/merged contributions for this editor
            const approvedBatches = await ChangeRequest.find({
                submittedBy: staff._id,
                status: { $in: ['APPROVED', 'PARTIALLY_APPROVED'] }
            }).sort({ reviewedAt: -1, updatedAt: -1 });

            let totalCreated = 0;
            let totalUpdated = 0;
            let totalDeleted = 0;

            approvedBatches.forEach(batch => {
                totalCreated += batch.counts?.created || 0;
                totalUpdated += batch.counts?.updated || 0;
                totalDeleted += batch.counts?.deleted || 0;
            });

            workspaces.push({
                editorId: staff._id,
                editorUsername: staff.username,
                role: staff.role || 'editor',
                activeDraft,
                history: approvedBatches,
                historyCount: approvedBatches.length,
                totalContributions: {
                    created: totalCreated,
                    updated: totalUpdated,
                    deleted: totalDeleted,
                    total: totalCreated + totalUpdated + totalDeleted
                }
            });
        }

        // Sort editors: editors with items in active draft or pending review come first
        workspaces.sort((a, b) => {
            const aPending = a.activeDraft?.status === 'PENDING_REVIEW' ? 3 : (a.activeDraft?.items?.length || 0) > 0 ? 2 : a.role === 'editor' ? 1 : 0;
            const bPending = b.activeDraft?.status === 'PENDING_REVIEW' ? 3 : (b.activeDraft?.items?.length || 0) > 0 ? 2 : b.role === 'editor' ? 1 : 0;
            return bPending - aPending;
        });

        res.json(workspaces);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 3. LIST CHANGE REQUESTS (with filters)
// -------------------------------------------------------------
router.get('/', authStaff, async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        const filter = {};

        if (status) {
            filter.status = status;
        }

        // If editor, show their own requests OR any pending review
        if (req.admin.role === 'editor' && !status) {
            filter.$or = [
                { submittedBy: req.admin._id },
                { status: 'PENDING_REVIEW' }
            ];
        }

        const requests = await ChangeRequest.find(filter)
            .sort({ updatedAt: -1 })
            .limit(Number(limit))
            .select('-items.originalData -items.proposedData'); // lightweight list

        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 4. CREATE NEW CHANGE REQUEST (Manual named batch)
// -------------------------------------------------------------
router.post('/create', authStaff, async (req, res) => {
    try {
        const { title, description, targetDb = 'ipl', targetCollection = 'ipl_data' } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title is required for a change request' });
        }

        const newRequest = new ChangeRequest({
            title: title.trim(),
            description: description ? description.trim() : '',
            submittedBy: req.admin._id,
            editorUsername: req.admin.username,
            targetDb,
            targetCollection,
            status: 'DRAFT',
            items: []
        });

        await newRequest.save();
        res.status(201).json(newRequest);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 5. GET DETAILS + LIVE CONFLICT CHECK
// -------------------------------------------------------------
router.get('/:id', authStaff, async (req, res) => {
    try {
        const request = await ChangeRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Change request not found' });

        // Run live conflict checks if request is pending review or draft
        if (request.status === 'PENDING_REVIEW' || request.status === 'DRAFT') {
            const db = getTargetDb(request.targetDb || 'ipl');
            
            for (const item of request.items) {
                if (item.actionType === 'UPDATE' || item.actionType === 'DELETE') {
                    const currentDoc = await findCurrentPlayerDoc(
                        db,
                        item.targetCollection || 'ipl_data',
                        item.playerId,
                        item.targetDocId
                    );

                    const conflictResult = checkConcurrentConflict(item.originalData, currentDoc);
                    item.hasConflict = conflictResult.hasConflict;
                    item.conflictDetails = conflictResult.hasConflict ? conflictResult : null;
                }
            }
        }

        res.json(request);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 6. STAGE AN ITEM (Create, Update, or Delete player in draft)
// -------------------------------------------------------------
router.post('/:id/stage', authStaff, async (req, res) => {
    try {
        const request = await ChangeRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Change request not found' });

        if (request.status !== 'DRAFT') {
            return res.status(400).json({
                error: 'Cannot add items to a request that is not in DRAFT status. Create a new draft.'
            });
        }

        // Check ownership (only creator or admin can add to this draft)
        if (req.admin.role === 'editor' && String(request.submittedBy) !== String(req.admin._id)) {
            return res.status(403).json({ error: 'You can only edit your own drafts' });
        }

        const {
            actionType,
            playerId,
            targetDocId,
            playerName,
            targetDb = request.targetDb || 'ipl',
            targetCollection = request.targetCollection || 'ipl_data',
            originalData = null,
            proposedData = null
        } = req.body;

        if (!['CREATE', 'UPDATE', 'DELETE'].includes(actionType)) {
            return res.status(400).json({ error: 'Invalid actionType. Must be CREATE, UPDATE, or DELETE' });
        }

        if (!playerName || !playerName.trim()) {
            return res.status(400).json({ error: 'Player name is required' });
        }

        // Calculate diff
        let diff = {};
        if (actionType === 'UPDATE') {
            diff = computePlayerDiff(originalData, proposedData);
            if (Object.keys(diff).length === 0) {
                return res.status(400).json({ error: 'No changes detected between original and proposed values' });
            }
        } else if (actionType === 'CREATE') {
            diff = computePlayerDiff({}, proposedData || {});
        } else if (actionType === 'DELETE') {
            diff = { _status: { old: 'ACTIVE', new: 'DELETED' } };
        }

        // Check if an item for this player already exists in this draft
        const existingItemIndex = request.items.findIndex(i => 
            (targetDocId && i.targetDocId === String(targetDocId)) ||
            (playerId && i.playerId === String(playerId)) ||
            (actionType === 'CREATE' && i.actionType === 'CREATE' && i.playerName.toLowerCase() === playerName.trim().toLowerCase())
        );

        const newItemData = {
            actionType,
            playerId: playerId ? String(playerId) : undefined,
            targetDocId: targetDocId ? String(targetDocId) : undefined,
            playerName: playerName.trim(),
            targetDb,
            targetCollection,
            originalData,
            proposedData,
            diff,
            status: 'PENDING',
            hasConflict: false,
            createdAt: new Date()
        };

        if (existingItemIndex > -1) {
            request.items[existingItemIndex] = newItemData;
        } else {
            request.items.push(newItemData);
        }

        await request.save();
        res.json({ message: 'Item staged successfully', request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 7. REMOVE AN ITEM FROM DRAFT
// -------------------------------------------------------------
router.delete('/:id/items/:itemId', authStaff, async (req, res) => {
    try {
        const request = await ChangeRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Change request not found' });

        if (request.status !== 'DRAFT') {
            return res.status(400).json({ error: 'Cannot modify items on non-draft requests' });
        }

        request.items = request.items.filter(i => String(i._id) !== String(req.params.itemId));
        await request.save();

        res.json({ message: 'Item removed from draft', request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 8. SUBMIT DRAFT FOR ADMIN REVIEW
// -------------------------------------------------------------
router.post('/:id/submit', authStaff, async (req, res) => {
    try {
        const request = await ChangeRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Change request not found' });

        if (request.status !== 'DRAFT') {
            return res.status(400).json({ error: 'Only DRAFT requests can be submitted for review' });
        }

        if (!request.items || request.items.length === 0) {
            return res.status(400).json({ error: 'Cannot submit an empty draft. Please stage changes first.' });
        }

        request.status = 'PENDING_REVIEW';
        request.updatedAt = new Date();
        await request.save();

        res.json({ message: 'Change request submitted for admin review successfully', request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 9. ADMIN REVIEW: APPROVE, MERGE TO PRIMARY DB, OR REJECT
// -------------------------------------------------------------
router.post('/:id/review', authStaff, requireAdmin, async (req, res) => {
    try {
        const { decision, adminNotes = '', itemDecisions = {} } = req.body;
        // decision: 'APPROVE' | 'REJECT' | 'PARTIAL'

        if (!['APPROVE', 'REJECT', 'PARTIAL'].includes(decision)) {
            return res.status(400).json({ error: 'Invalid decision. Must be APPROVE, REJECT, or PARTIAL' });
        }

        const request = await ChangeRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Change request not found' });

        if (request.status !== 'PENDING_REVIEW' && request.status !== 'DRAFT') {
            return res.status(400).json({ error: `Cannot review request with status ${request.status}` });
        }

        const targetDbName = request.targetDb || 'ipl';
        const db = getTargetDb(targetDbName);
        const league = resolveLeague(targetDbName);
        const masterColl = getMasterCollection(league);

        let approvedCount = 0;
        let rejectedCount = 0;
        let requiresCacheReload = false;

        // Process items
        for (const item of request.items) {
            const itemIdStr = String(item._id);
            let itemApproved = false;

            if (decision === 'APPROVE') {
                itemApproved = true;
            } else if (decision === 'REJECT') {
                itemApproved = false;
            } else if (decision === 'PARTIAL') {
                itemApproved = itemDecisions[itemIdStr] === 'APPROVED';
            }

            if (!itemApproved) {
                item.status = 'REJECTED';
                item.rejectionReason = adminNotes || 'Rejected by Admin';
                rejectedCount++;
                continue;
            }

            // Execute Approved Change into Primary DB
            const collName = item.targetCollection || 'ipl_data';
            const coll = db.collection(collName);

            try {
                if (item.actionType === 'CREATE') {
                    const toInsert = { ...item.proposedData };
                    delete toInsert._id;
                    if (toInsert.name && !toInsert.player) toInsert.player = toInsert.name;
                    toInsert.createdAt = new Date();
                    toInsert.updatedAt = new Date();

                    const insertResult = await coll.insertOne(toInsert);
                    toInsert._id = insertResult.insertedId;

                    // Also sync to master collection if applicable
                    if (masterColl && collName !== masterColl) {
                        try {
                            await db.collection(masterColl).insertOne(toInsert);
                        } catch {}
                    }

                    requiresCacheReload = true;
                    item.status = 'APPROVED';
                    approvedCount++;

                } else if (item.actionType === 'UPDATE') {
                    let filter = {};
                    if (item.targetDocId && ObjectId.isValid(item.targetDocId)) {
                        filter = { _id: new ObjectId(item.targetDocId) };
                    } else if (item.playerId) {
                        filter = buildPlayerIdQuery(item.playerId);
                    }

                    const updates = { ...item.proposedData };
                    delete updates._id;
                    delete updates.id;
                    updates.updatedAt = new Date();

                    await coll.updateOne(filter, { $set: updates });

                    // Also update master collection if applicable
                    if (masterColl && collName !== masterColl) {
                        try {
                            await db.collection(masterColl).updateOne(filter, { $set: updates });
                        } catch {}
                    }

                    requiresCacheReload = true;
                    item.status = 'APPROVED';
                    approvedCount++;

                } else if (item.actionType === 'DELETE') {
                    let filter = {};
                    if (item.targetDocId && ObjectId.isValid(item.targetDocId)) {
                        filter = { _id: new ObjectId(item.targetDocId) };
                    } else if (item.playerId) {
                        filter = buildPlayerIdQuery(item.playerId);
                    }

                    await coll.deleteOne(filter);

                    if (masterColl && collName !== masterColl) {
                        try {
                            await db.collection(masterColl).deleteOne(filter);
                        } catch {}
                    }

                    requiresCacheReload = true;
                    item.status = 'APPROVED';
                    approvedCount++;
                }
            } catch (err) {
                console.error(`Failed to apply change item ${item._id}:`, err);
                item.status = 'REJECTED';
                item.rejectionReason = `Database execution failed: ${err.message}`;
                rejectedCount++;
            }
        }

        // Determine final overall status
        if (approvedCount > 0 && rejectedCount === 0) {
            request.status = 'APPROVED';
        } else if (approvedCount > 0 && rejectedCount > 0) {
            request.status = 'PARTIALLY_APPROVED';
        } else {
            request.status = 'REJECTED';
        }

        request.adminNotes = adminNotes;
        request.reviewedBy = req.admin._id;
        request.reviewerUsername = req.admin.username;
        request.reviewedAt = new Date();
        await request.save();

        // Automatically ensure the editor has a clean, active DRAFT ready for their next work
        const existingDraft = await ChangeRequest.findOne({
            submittedBy: request.submittedBy,
            status: 'DRAFT'
        });
        if (!existingDraft) {
            const newDraft = new ChangeRequest({
                title: `Draft Session - ${request.editorUsername}`,
                submittedBy: request.submittedBy,
                editorUsername: request.editorUsername,
                status: 'DRAFT',
                items: []
            });
            await newDraft.save();
        }

        // Sync PlayerCache if changes affected live player data
        if (requiresCacheReload && league === 'ipl') {
            try {
                await PlayerCache.load();
                console.log(`[PlayerCache] Successfully reloaded cache following ChangeRequest approval (${request._id})`);
            } catch (cacheErr) {
                console.warn('[PlayerCache reload warning]:', cacheErr.message);
            }
        }

        res.json({
            message: `Review processed. ${approvedCount} approved, ${rejectedCount} rejected.`,
            status: request.status,
            request
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// -------------------------------------------------------------
// 10. DISCARD/DELETE DRAFT
// -------------------------------------------------------------
router.delete('/:id', authStaff, async (req, res) => {
    try {
        const request = await ChangeRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Change request not found' });

        // Only creator can delete their draft; Admin can delete any
        if (req.admin.role === 'editor') {
            if (String(request.submittedBy) !== String(req.admin._id) || request.status !== 'DRAFT') {
                return res.status(403).json({ error: 'Editors can only delete their own DRAFT requests' });
            }
        }

        await ChangeRequest.findByIdAndDelete(req.params.id);

        // Ensure a clean draft remains available for this user
        if (request.status === 'DRAFT' || request.status === 'PENDING_REVIEW') {
            const existingDraft = await ChangeRequest.findOne({
                submittedBy: request.submittedBy,
                status: 'DRAFT'
            });
            if (!existingDraft) {
                const newDraft = new ChangeRequest({
                    title: `Draft Session - ${request.editorUsername}`,
                    submittedBy: request.submittedBy,
                    editorUsername: request.editorUsername,
                    status: 'DRAFT',
                    items: []
                });
                await newDraft.save();
            }
        }

        res.json({ message: 'Change request discarded successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
