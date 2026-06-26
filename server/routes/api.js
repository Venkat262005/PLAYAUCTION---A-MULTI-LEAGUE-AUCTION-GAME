const express = require('express');
const router = express.Router();
const AuctionRoom = require('../models/AuctionRoom');
const Feedback = require('../models/Feedback');
const { evaluateAllTeams } = require('../services/aiRating');

router.get('/room/:roomCode', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const room = await AuctionRoom.findOne({ roomId: roomCode });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/room/:roomCode/results', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const room = await AuctionRoom.findOne({ roomId: roomCode })
            .populate('franchisesInRoom.franchiseId')
            .populate('franchisesInRoom.playersAcquired.player');

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (room.status !== 'Finished') {
            return res.status(400).json({ error: 'Auction is not finished yet' });
        }

        // Sort teams by overallScore descending and assign rank (1 = best)
        const sorted = [...room.franchisesInRoom].sort((a, b) => {
            const scoreA = a.evaluation?.overallScore ?? 0;
            const scoreB = b.evaluation?.overallScore ?? 0;
            return scoreB - scoreA;
        });
        sorted.forEach((team, i) => { team.rank = i + 1; });

        res.json({
            teams: sorted,
            league: room.league || 'ipl',
            currency: room.currency || 'inr',
            quizLeaderboard: room.quizLeaderboard || [],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error generating results' });
    }
});

router.get('/players', async (req, res) => {
    try {
        const { league } = req.query;
        const { fetchAllPlayers } = require('../services/playerService');
        const players = await fetchAllPlayers(league);
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/feedback', async (req, res) => {
    try {
        const {
            name,
            userId,
            playerName,
            roomCode,
            league,
            page,
            category,
            message,
            contact,
        } = req.body || {};

        const trimmedMessage = String(message || '').trim();
        if (!trimmedMessage) {
            return res.status(400).json({ error: 'Feedback message is required' });
        }

        const feedback = await Feedback.create({
            name: String(name || playerName || 'Anonymous').trim().slice(0, 80) || 'Anonymous',
            userId: userId || null,
            playerName: playerName || null,
            roomCode: roomCode || null,
            league: ['ipl', 'wpl', 'sa20'].includes(String(league || '').toLowerCase()) ? String(league).toLowerCase() : 'ipl',
            page: String(page || '/').slice(0, 200),
            category: ['bug', 'improvement', 'feature', 'general'].includes(String(category || '').toLowerCase())
                ? String(category).toLowerCase()
                : 'general',
            message: trimmedMessage.slice(0, 2000),
            contact: String(contact || '').trim().slice(0, 120),
            userAgent: String(req.headers['user-agent'] || '').slice(0, 300)
        });

        res.status(201).json({ message: 'Feedback submitted successfully', id: feedback._id });
    } catch (error) {
        console.error('[FEEDBACK] Create failed:', error.message);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

module.exports = router;
