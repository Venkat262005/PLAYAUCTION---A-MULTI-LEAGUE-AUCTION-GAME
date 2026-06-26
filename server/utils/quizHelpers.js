/**
 * Quiz leaderboard helpers — score first, avg response time as tiebreaker.
 */

function buildQuizLeaderboard(scores = {}) {
    return Object.entries(scores)
        .map(([userId, data]) => {
            const times = (data.responseTimes || []).map((t) => t.ms);
            const avgResponseMs = times.length
                ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
                : 999999;

            return {
                userId,
                name: data.name || 'Player',
                score: data.score || 0,
                avgResponseMs,
                avgResponseSec: (avgResponseMs / 1000).toFixed(1),
                correctCount: data.correctCount || 0,
                totalAnswered: (data.answered || []).length,
            };
        })
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.avgResponseMs - b.avgResponseMs;
        })
        .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

function getSafeQuizQuestion(q, index, total, timeLimit = 12) {
    return {
        quizIndex: q.quizIndex,
        text: q.text,
        options: q.options,
        difficulty: q.difficulty,
        points: q.points,
        questionNumber: index + 1,
        totalQuestions: total,
        timeLimit,
    };
}

module.exports = { buildQuizLeaderboard, getSafeQuizQuestion };
