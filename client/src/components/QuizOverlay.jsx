import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';

const QuizOverlay = ({ roomCode }) => {
    const { socket } = useSocket();
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [resultData, setResultData] = useState(null);
    const [questionTimer, setQuestionTimer] = useState(10);
    const [isQuizActive, setIsQuizActive] = useState(true);

    useEffect(() => {
        if (!socket) return;

        socket.on('quiz_question', (q) => {
            setCurrentQuestion(q);
            setSelectedAnswer(null);
            setResultData(null);
            setQuestionTimer(10);
        });

        socket.on('quiz_leaderboard_update', ({ scores }) => {
            if (!scores) return;
            const sorted = Object.values(scores).sort((a, b) => b.score - a.score);
            setLeaderboard(sorted.slice(0, 5)); // Top 5
        });

        socket.on('quiz_answer_result', (res) => {
            setResultData(res);
        });

        socket.on('quiz_ended', () => {
            setIsQuizActive(false);
            setCurrentQuestion(null);
        });

        return () => {
            socket.off('quiz_question');
            socket.off('quiz_leaderboard_update');
            socket.off('quiz_answer_result');
            socket.off('quiz_ended');
        };
    }, [socket]);

    useEffect(() => {
        if (!currentQuestion) return;
        const interval = setInterval(() => {
            setQuestionTimer(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [currentQuestion]);

    const handleAnswer = (index) => {
        if (selectedAnswer !== null || !socket || !currentQuestion) return;
        setSelectedAnswer(index);
        socket.emit('submit_quiz_answer', {
            roomCode,
            quizIndex: currentQuestion.quizIndex,
            answerIndex: index
        });
    };

    if (!isQuizActive) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none p-4 md:p-8">
            <div className="flex w-full max-w-5xl gap-6 items-start h-full pt-10">
                
                {/* Main Question Card */}
                {currentQuestion && (
                    <motion.div 
                        key={currentQuestion.quizIndex}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="flex-1 bg-slate-900/90 backdrop-blur-xl border border-yellow-500/30 rounded-3xl p-6 md:p-8 shadow-2xl pointer-events-auto"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex gap-3 items-center">
                                <span className="bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                                    Q{currentQuestion.questionNumber} / {currentQuestion.totalQuestions}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase ${
                                    currentQuestion.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                                    currentQuestion.difficulty === 'medium' ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-red-500/20 text-red-400'
                                }`}>
                                    {currentQuestion.difficulty} ({currentQuestion.points}pt)
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-full border-2 border-yellow-500/50 flex items-center justify-center font-mono text-xl font-bold text-white shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                                {questionTimer}
                            </div>
                        </div>

                        <h2 className="text-xl md:text-2xl font-bold text-white mb-8 leading-relaxed">
                            {currentQuestion.text}
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentQuestion.options.map((opt, idx) => {
                                let stateClasses = "bg-white/5 border-white/10 hover:bg-white/10 text-slate-300";
                                
                                if (selectedAnswer === idx) {
                                    stateClasses = "bg-blue-500/20 border-blue-500/50 text-white";
                                    if (resultData) {
                                        if (resultData.correct) stateClasses = "bg-green-500/30 border-green-500 text-green-100 shadow-[0_0_20px_rgba(34,197,94,0.3)]";
                                        else stateClasses = "bg-red-500/30 border-red-500 text-red-100";
                                    }
                                } else if (resultData && resultData.correctIndex === idx) {
                                    stateClasses = "bg-green-500/30 border-green-500 text-green-100 shadow-[0_0_20px_rgba(34,197,94,0.3)]";
                                }

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleAnswer(idx)}
                                        disabled={selectedAnswer !== null || questionTimer === 0}
                                        className={`text-left p-4 rounded-xl border transition-all duration-200 ${stateClasses} ${selectedAnswer === null && questionTimer > 0 ? 'cursor-pointer' : 'cursor-not-allowed opacity-90'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded bg-black/30 flex items-center justify-center font-bold text-sm shrink-0">
                                                {String.fromCharCode(65 + idx)}
                                            </div>
                                            <span className="font-semibold text-sm md:text-base">{opt}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="mt-8 h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: '100%' }}
                                animate={{ width: `${(questionTimer / 10) * 100}%` }}
                                transition={{ duration: 1, ease: "linear" }}
                                className={`h-full ${questionTimer <= 3 ? 'bg-red-500' : 'bg-yellow-500'}`}
                            />
                        </div>
                    </motion.div>
                )}

                {/* Leaderboard Sidebar */}
                {leaderboard.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-72 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl pointer-events-auto hidden lg:block shrink-0"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">🏆</span>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Quiz Leaderboard</h3>
                        </div>
                        
                        <div className="space-y-3">
                            <AnimatePresence>
                                {leaderboard.map((user, idx) => (
                                    <motion.div 
                                        key={user.name}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex items-center justify-between p-3 rounded-xl border ${idx === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white'}`}>
                                                {idx + 1}
                                            </div>
                                            <span className="text-sm font-bold text-white truncate">{user.name}</span>
                                        </div>
                                        <div className="font-mono font-bold text-yellow-400 shrink-0">
                                            {user.score}pt
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default QuizOverlay;
