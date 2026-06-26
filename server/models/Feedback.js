const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    name: { type: String, default: 'Anonymous' },
    userId: { type: String, default: null },
    playerName: { type: String, default: null },
    roomCode: { type: String, default: null },
    league: { type: String, default: 'ipl' },
    page: { type: String, default: '/' },
    category: {
        type: String,
        enum: ['bug', 'improvement', 'feature', 'general'],
        default: 'general'
    },
    message: { type: String, required: true, trim: true },
    contact: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    status: {
        type: String,
        enum: ['new', 'reviewed', 'resolved'],
        default: 'new'
    }
}, { timestamps: true });

feedbackSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
