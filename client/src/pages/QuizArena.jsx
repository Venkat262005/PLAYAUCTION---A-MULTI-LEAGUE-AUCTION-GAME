import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { useSession } from '../context/SessionContext';
import { Zap, Trophy, Clock, Brain, ChevronRight } from 'lucide-react';

const DIFFICULTY_STYLES = {
    easy: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'EASY' },
    medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: 'MEDIUM' },
    hard: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', label: 'HARD' },
};

const QuizArena = () => {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const { socket } = useSocket();
    const { playerName } = useSession();

    const [phase, setPhase] = useState('intro'); // intro | active | finished
    const [league, setLeague] = useState('ipl');
    const [totalQuestions, setTotalQuestions] = useState(10);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [resultData, setResultData] = useState(null);
    const [questionTimer, setQuestionTimer] = useState(12);
    const [revealData, setRevealData] = useState(null);
    const [finalLeaderboard, setFinalLeaderboard] = useState([]);
    const [countdownToEval, setCountdownToEval] = useState(5);

    useEffect(() => {
        if (!socket || !roomCode) return;

        const onQuizStart = ({ league: lg, totalQuestions: total }) => {
            setLeague(lg || 'ipl');
            setTotalQuestions(total || 10);
            setPhase('active');
        };

        const onQuestion = (q) => {
            setCurrentQuestion(q);
            setSelectedAnswer(null);
            setResultData(null);
            setRevealData(null);
            setQuestionTimer(q.timeLimit || 12);
        };

        const onTimerTick = ({ remaining }) => setQuestionTimer(remaining);

        const onLeaderboard = ({ leaderboard: lb }) => {
            if (Array.isArray(lb)) setLeaderboard(lb);
        };

        const onAnswerResult = (res) => setResultData(res);

        const onQuestionClosed = (data) => {
            setRevealData(data);
            setCurrentQuestion(null);
        };

        const onQuizEnded = ({ leaderboard: lb }) => {
            setPhase('finished');
            if (Array.isArray(lb)) setFinalLeaderboard(lb);
            setCurrentQuestion(null);
        };

        socket.on('quiz_phase_started', onQuizStart);
        socket.on('quiz_question', onQuestion);
        socket.on('quiz_timer_tick', onTimerTick);
        socket.on('quiz_leaderboard_update', onLeaderboard);
        socket.on('quiz_answer_result', onAnswerResult);
        socket.on('quiz_question_closed', onQuestionClosed);
        socket.on('quiz_phase_ended', onQuizEnded);

        return () => {
            socket.off('quiz_phase_started', onQuizStart);
            socket.off('quiz_question', onQuestion);
            socket.off('quiz_timer_tick', onTimerTick);
            socket.off('quiz_leaderboard_update', onLeaderboard);
            socket.off('quiz_answer_result', onAnswerResult);
            socket.off('quiz_question_closed', onQuestionClosed);
            socket.off('quiz_phase_ended', onQuizEnded);
        };
    }, [socket, roomCode]);

    useEffect(() => {
        if (!socket || !roomCode) return;
        const rejoin = () => socket.emit('join_room', { roomCode });
        if (socket.connected) rejoin();
        else socket.on('connect', rejoin);
        return () => socket.off('connect', rejoin);
    }, [socket, roomCode]);

    useEffect(() => {
        if (phase !== 'finished') return;
        const t = setInterval(() => {
            setCountdownToEval((c) => {
                if (c <= 1) {
                    clearInterval(t);
                    navigate(`/evaluating/${roomCode}`);
                    return 0;
                }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [phase, navigate, roomCode]);

    const handleAnswer = useCallback((index) => {
        if (selectedAnswer !== null || !socket || !currentQuestion) return;
        setSelectedAnswer(index);
        socket.emit('submit_quiz_answer', {
            roomCode,
            quizIndex: currentQuestion.quizIndex,
            answerIndex: index,
        });
    }, [selectedAnswer, socket, currentQuestion, roomCode]);

    const diffStyle = currentQuestion ? (DIFFICULTY_STYLES[currentQuestion.difficulty] || DIFFICULTY_STYLES.easy) : null;
    const progressPct = currentQuestion
        ? ((currentQuestion.questionNumber - 1) / totalQuestions) * 100
        : phase === 'finished' ? 100 : 0;

    return (
        <div className="min-h-[100dvh] bg-[#06040f] text-white overflow-hidden relative font-sans">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(139,92,246,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(139,92,246,0.04)_1px,transparent_1px)] bg-[size:3rem_3rem]" />
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-amber-500/8 blur-[140px] rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 md:py-10 min-h-[100dvh] flex flex-col">
                {/* Header */}
                <header className="flex items-center justify-between mb-6 md:mb-8">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-violet-400/60 mb-1">Post-Auction Showdown</p>
                        <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight flex items-center gap-3">
                            <Brain className="w-7 h-7 md:w-9 md:h-9 text-violet-400" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-white to-amber-300">
                                Trivia Arena
                            </span>
                        </h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                            Room {roomCode} · {(league || 'ipl').toUpperCase()}
                        </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        Ties broken by fastest avg time
                    </div>
                </header>

                {/* Progress rail */}
                <div className="mb-6">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">
                        <span>Progress</span>
                        <span>{phase === 'finished' ? totalQuestions : currentQuestion?.questionNumber || 0} / {totalQuestions}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400"
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                    {/* Main card */}
                    <div className="lg:col-span-8 flex flex-col min-h-[420px]">
                        <AnimatePresence mode="wait">
                            {phase === 'intro' && (
                                <motion.div
                                    key="intro"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-[2rem] border border-violet-500/20 bg-violet-500/5"
                                >
                                    <motion.div
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="w-20 h-20 rounded-3xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-6"
                                    >
                                        <Zap className="w-10 h-10 text-violet-300" />
                                    </motion.div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Auction&apos;s Over — Brain Battle Begins!</h2>
                                    <p className="text-slate-400 text-sm max-w-md">10 rapid-fire {(league || 'ipl').toUpperCase()} questions. Score points, climb the board. Same score? Fastest fingers win.</p>
                                </motion.div>
                            )}

                            {phase === 'active' && currentQuestion && (
                                <motion.div
                                    key={`q-${currentQuestion.quizIndex}`}
                                    initial={{ opacity: 0, x: 30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -30 }}
                                    className="flex-1 rounded-[2rem] border border-white/10 bg-[#0c0a18]/90 backdrop-blur-xl p-6 md:p-8 shadow-2xl flex flex-col justify-start"
                                >
                                    <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                                        <div className="flex gap-2 flex-wrap">
                                            <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                                Q{currentQuestion.questionNumber} / {currentQuestion.totalQuestions}
                                            </span>
                                            {diffStyle && (
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${diffStyle.bg} ${diffStyle.text} ${diffStyle.border}`}>
                                                    {diffStyle.label} · {currentQuestion.points}pt
                                                </span>
                                            )}
                                        </div>
                                        <div className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center font-mono text-2xl font-black transition-colors ${
                                            questionTimer <= 3 ? 'border-rose-500 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'border-amber-500/50 text-amber-300'
                                        }`}>
                                            {questionTimer}
                                        </div>
                                    </div>

                                    <h2 className="text-xl md:text-2xl font-bold leading-relaxed mb-5">
                                        {currentQuestion.text}
                                    </h2>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                        {currentQuestion.options.map((opt, idx) => {
                                            let cls = 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-slate-200';
                                            if (selectedAnswer === idx) {
                                                cls = resultData?.correct
                                                    ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-[0_0_24px_rgba(52,211,153,0.25)]'
                                                    : 'bg-rose-500/25 border-rose-400 text-white';
                                            } else if (resultData && resultData.correctIndex === idx) {
                                                cls = 'bg-emerald-500/20 border-emerald-400/80 text-emerald-100';
                                            }
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => handleAnswer(idx)}
                                                    disabled={selectedAnswer !== null || questionTimer === 0}
                                                    className={`text-left p-4 rounded-2xl border transition-all duration-200 ${cls} disabled:cursor-not-allowed`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center font-black text-sm shrink-0">
                                                            {String.fromCharCode(65 + idx)}
                                                        </span>
                                                        <span className="font-semibold text-sm md:text-base">{opt}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-6 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                        <motion.div
                                            className={`h-full ${questionTimer <= 3 ? 'bg-rose-500' : 'bg-gradient-to-r from-violet-500 to-amber-400'}`}
                                            animate={{ width: `${(questionTimer / (currentQuestion.timeLimit || 12)) * 100}%` }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {phase === 'active' && !currentQuestion && revealData && (
                                <motion.div
                                    key="reveal"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex-1 flex flex-col items-center justify-center rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-8 text-center"
                                >
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400/70 mb-3">Answer Reveal</p>
                                    <h3 className="text-2xl font-black text-emerald-300 mb-2">{revealData.correctAnswer}</h3>
                                    <p className="text-slate-400 text-sm">Next question incoming...</p>
                                </motion.div>
                            )}

                            {phase === 'finished' && (
                                <motion.div
                                    key="done"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex-1 flex flex-col items-center justify-center rounded-[2rem] border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-violet-500/5 p-8 text-center"
                                >
                                    <Trophy className="w-16 h-16 text-amber-400 mb-4" />
                                    <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Trivia Complete!</h2>
                                    <p className="text-slate-400 mb-6">Heading to AI evaluation lobby in {countdownToEval}s</p>
                                    <div className="flex items-center gap-2 text-violet-300 text-sm font-bold uppercase tracking-widest">
                                        <span>Analyzing squads</span>
                                        <ChevronRight className="w-4 h-4 animate-pulse" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Leaderboard */}
                    <div className="lg:col-span-4">
                        <div className="sticky top-6 rounded-[2rem] border border-white/10 bg-[#0c0a18]/80 backdrop-blur-xl p-5 shadow-xl h-full max-h-[520px] flex flex-col">
                            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
                                <Trophy className="w-5 h-5 text-amber-400" />
                                <h3 className="text-xs font-black uppercase tracking-[0.3em]">Live Leaderboard</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                                {(phase === 'finished' ? finalLeaderboard : leaderboard).length === 0 ? (
                                    <p className="text-slate-500 text-sm text-center py-8">Answer questions to appear here</p>
                                ) : (
                                    (phase === 'finished' ? finalLeaderboard : leaderboard).map((user, idx) => {
                                        const isMe = user.name === playerName;
                                        return (
                                            <motion.div
                                                key={user.userId || user.name}
                                                layout
                                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                    idx === 0 ? 'bg-amber-500/10 border-amber-500/30' :
                                                    isMe ? 'bg-violet-500/10 border-violet-500/30' :
                                                    'bg-white/[0.03] border-white/5'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                                        idx === 0 ? 'bg-amber-500 text-black' : 'bg-white/10'
                                                    }`}>
                                                        {user.rank || idx + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold truncate">{user.name}{isMe ? ' (You)' : ''}</div>
                                                        <div className="text-[9px] text-slate-500 font-mono">{user.avgResponseSec}s avg</div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="font-mono font-black text-amber-400">{user.score}pt</div>
                                                    <div className="text-[9px] text-slate-600">{user.correctCount || 0} correct</div>
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                            <p className="text-[9px] text-slate-600 text-center mt-3 uppercase tracking-wider">
                                Same points → faster avg wins
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuizArena;
