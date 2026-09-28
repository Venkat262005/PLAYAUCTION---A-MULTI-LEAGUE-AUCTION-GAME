const mongoose = require('mongoose');

const ChangeItemSchema = new mongoose.Schema({
    actionType: { 
        type: String, 
        enum: ['CREATE', 'UPDATE', 'DELETE'], 
        required: true 
    },
    playerId: { type: String }, // Custom playerId or identifier
    targetDocId: { type: String }, // MongoDB _id if updating/deleting existing document
    playerName: { type: String, required: true },
    targetDb: { type: String, default: 'ipl' },
    targetCollection: { type: String, default: 'ipl_data' },
    originalData: { type: mongoose.Schema.Types.Mixed, default: null }, // Snapshot of record before edit
    proposedData: { type: mongoose.Schema.Types.Mixed, default: null }, // The new/edited values
    diff: { type: mongoose.Schema.Types.Mixed, default: {} }, // Field-level differences: { field: { old, new } }
    status: { 
        type: String, 
        enum: ['PENDING', 'APPROVED', 'REJECTED'], 
        default: 'PENDING' 
    },
    rejectionReason: { type: String, default: '' },
    hasConflict: { type: Boolean, default: false },
    conflictDetails: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now }
});

const ChangeRequestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    editorUsername: { type: String, required: true },
    status: {
        type: String,
        enum: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PARTIALLY_APPROVED'],
        default: 'DRAFT'
    },
    targetDb: { type: String, default: 'ipl' },
    targetCollection: { type: String, default: 'ipl_data' },
    items: [ChangeItemSchema],
    counts: {
        created: { type: Number, default: 0 },
        updated: { type: Number, default: 0 },
        deleted: { type: Number, default: 0 }
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewerUsername: { type: String },
    adminNotes: { type: String, default: '' },
    reviewedAt: { type: Date }
}, { timestamps: true });

// Auto-recalculate counts before saving
ChangeRequestSchema.pre('save', function() {
    if (this.items) {
        this.counts = {
            created: this.items.filter(i => i.actionType === 'CREATE').length,
            updated: this.items.filter(i => i.actionType === 'UPDATE').length,
            deleted: this.items.filter(i => i.actionType === 'DELETE').length
        };
    }
});

module.exports = mongoose.model('ChangeRequest', ChangeRequestSchema);
