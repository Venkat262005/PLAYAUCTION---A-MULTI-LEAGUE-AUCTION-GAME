const fs = require('fs');
const path = require('path');

// Cache the parsed questions
const quizCache = {
    ipl: null,
    sa20: null,
    wpl: null
};

/**
 * Parses the quiz text file and categorizes questions into Easy, Medium, Hard.
 */
function parseQuizFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`[QuizEngine] File not found: ${filePath}`);
        return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const categorizedQuestions = {
        easy: [],
        medium: [],
        hard: []
    };

    let currentCategory = 'easy'; // Default
    let currentQuestion = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Detect category change
        if (line.toLowerCase().includes('### easy')) currentCategory = 'easy';
        else if (line.toLowerCase().includes('### medium')) currentCategory = 'medium';
        else if (line.toLowerCase().includes('### hard')) currentCategory = 'hard';

        // Detect new question (starts with number and dot)
        const qMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (qMatch) {
            if (currentQuestion) {
                categorizedQuestions[currentCategory].push(currentQuestion);
            }
            currentQuestion = {
                id: qMatch[1],
                text: qMatch[2],
                options: [],
                correctIndex: -1
            };
            continue;
        }

        // Detect options (starts with A), B), C), D))
        const optMatch = line.match(/^([A-D])\)\s+(.*)/);
        if (optMatch && currentQuestion) {
            let optionText = optMatch[2];
            let isCorrect = false;

            // Check if correct (wrapped in **)
            if (optionText.startsWith('**') && optionText.endsWith('**')) {
                isCorrect = true;
                optionText = optionText.substring(2, optionText.length - 2).trim();
            }

            currentQuestion.options.push(optionText);
            if (isCorrect) {
                currentQuestion.correctIndex = currentQuestion.options.length - 1;
            }
        }
    }

    // Push the last question
    if (currentQuestion) {
        categorizedQuestions[currentCategory].push(currentQuestion);
    }

    return categorizedQuestions;
}

/**
 * Get 10 random questions: 4 easy, 3 medium, 3 hard
 */
function generateQuiz(league) {
    const l = league ? league.toLowerCase() : 'ipl';
    
    if (!quizCache[l]) {
        let filename = 'IPL_Quiz_Questions.txt';
        if (l === 'sa20') filename = 'SA20_Quiz_Questions.txt';
        else if (l === 'wpl') filename = 'WPL_Quiz_Questions.txt';

        const filePath = path.join(__dirname, '../../client/quiz', filename);
        const parsed = parseQuizFile(filePath);
        if (parsed) {
            quizCache[l] = parsed;
        } else {
            // Fallback to IPL if specific league file fails
            if (l !== 'ipl' && !quizCache['ipl']) {
                 const fbPath = path.join(__dirname, '../../client/quiz/IPL_Quiz_Questions.txt');
                 quizCache['ipl'] = parseQuizFile(fbPath);
            }
            quizCache[l] = quizCache['ipl']; // use fallback
        }
    }

    const pool = quizCache[l];
    if (!pool) return [];

    // Helper to pick N random items
    const pickRandom = (arr, n) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
    };

    const easyQs = pickRandom(pool.easy, 4).map(q => ({ ...q, difficulty: 'easy', points: 1 }));
    const medQs = pickRandom(pool.medium, 3).map(q => ({ ...q, difficulty: 'medium', points: 2 }));
    const hardQs = pickRandom(pool.hard, 3).map(q => ({ ...q, difficulty: 'hard', points: 3 }));

    // Combine and shuffle the 10 questions
    const finalQuiz = [...easyQs, ...medQs, ...hardQs].sort(() => 0.5 - Math.random());
    
    // Remove correctIndex before sending to clients, but keep it in our server state
    return finalQuiz.map((q, idx) => ({
        ...q,
        quizIndex: idx // unique sequential ID for the session
    }));
}

module.exports = {
    generateQuiz
};
