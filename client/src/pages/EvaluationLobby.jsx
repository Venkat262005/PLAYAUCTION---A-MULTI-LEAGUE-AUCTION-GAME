import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { Cpu, Sparkles } from 'lucide-react';

const LOG_LINES = [
    { at: 85, text: 'Initializing tactical evaluation protocols...' },
    { at: 70, text: 'Assessing squad batting depth & anchor roles...' },
    { at: 55, text: 'Reconciling bowling economy & death-over metrics...' },
    { at: 40, text: 'Measuring overall team synergy & balance ratio...' },
    { at: 25, text: 'Generating match-winner ratings & historical index...' },
    { at: 10, text: 'Compiling final season verdicts...' },
];

const EvaluationLobby = () => {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [evalTimer, setEvalTimer] = useState(90);
    const [visibleLogs, setVisibleLogs] = useState([]);

    useEffect(() => {
        if (!socket || !roomCode) return;
        const rejoin = () => socket.emit('join_room', { roomCode });
        if (socket.connected) rejoin();
        else socket.on('connect', rejoin);
        return () => socket.off('connect', rejoin);
    }, [socket, roomCode]);

    useEffect(() => {
        if (!socket || !roomCode) return;

        const onEvalStart = ({ timer }) => setEvalTimer(timer ?? 90);
        const onEvalTick = ({ timer }) => setEvalTimer(timer);
        const onFinished = ({ teams, quizLeaderboard }) => {
            navigate(`/results/${roomCode}`, { state: { finalTeams: teams, quizLeaderboard } });
        };
        const onRoomJoined = ({ state }) => {
            if (state && state.status === 'Finished') {
                navigate(`/results/${roomCode}`, { state: { finalTeams: state.teams, quizLeaderboard: state.quizLeaderboard } });
            }
        };

        socket.on('evaluation_started', onEvalStart);
        socket.on('evaluation_timer_tick', onEvalTick);
        socket.on('auction_finished', onFinished);
        socket.on('room_joined', onRoomJoined);

        return () => {
            socket.off('evaluation_started', onEvalStart);
            socket.off('evaluation_timer_tick', onEvalTick);
            socket.off('auction_finished', onFinished);
            socket.off('room_joined', onRoomJoined);
        };
    }, [socket, roomCode, navigate]);

    useEffect(() => {
        const active = LOG_LINES.filter((l) => evalTimer <= l.at).map((l) => l.text);
        setVisibleLogs(active.slice(-4));
    }, [evalTimer]);

    const pct = Math.max(0, Math.min(100, ((90 - evalTimer) / 90) * 100));

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden font-sans select-none bg-[#040810]">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(56,189,248,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(56,189,248,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40" />
            <div className="absolute top-[-15%] right-[-5%] w-[550px] h-[550px] bg-blue-500/10 blur-[160px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-15%] left-[-5%] w-[550px] h-[550px] bg-violet-500/10 blur-[160px] rounded-full pointer-events-none" />

            <div className="z-10 flex flex-col items-center max-w-lg w-full">
                <div className="relative mb-10 flex items-center justify-center w-72 h-72">
                    <div className="absolute inset-0 border border-blue-500/15 rounded-full flex items-center justify-center">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-2 rounded-full border-t-2 border-t-blue-400/40 bg-gradient-to-t from-transparent to-blue-500/5"
                        />
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                            <motion.circle
                                cx="50" cy="50" r="46" fill="none" stroke="url(#evalGrad)" strokeWidth="2.5" strokeLinecap="round"
                                strokeDasharray={`${pct * 2.89} 289`}
                                initial={{ strokeDasharray: '0 289' }}
                                animate={{ strokeDasharray: `${pct * 2.89} 289` }}
                                transition={{ duration: 0.8 }}
                            />
                            <defs>
                                <linearGradient id="evalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#38bdf8" />
                                    <stop offset="100%" stopColor="#a78bfa" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    <div className="z-10 p-8 rounded-[2rem] border border-blue-500/25 flex flex-col items-center min-w-[200px] bg-slate-950/85 backdrop-blur-xl shadow-[0_0_60px_rgba(56,189,248,0.12)]">
                        <Cpu className="w-6 h-6 text-blue-400 mb-2" />
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.35em] mb-2">AI Evaluation</div>
                        <div className="text-6xl font-black font-mono tracking-tighter text-white">
                            {evalTimer}
                            <span className="text-xl text-blue-400 ml-1 font-sans">s</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                    <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-white to-violet-300">
                        Analyzing Squads
                    </h1>
                </div>
                <p className="text-slate-500 text-xs md:text-sm leading-relaxed max-w-md mb-8 font-semibold uppercase tracking-wider">
                    Gemini AI is scoring every franchise — balance, firepower, depth & tactical fit.
                </p>

                <div className="w-full bg-black/50 border border-white/8 rounded-2xl p-5 font-mono text-left text-[11px] backdrop-blur-md shadow-2xl">
                    <div className="flex items-center gap-2 text-[9px] text-slate-500 font-bold uppercase tracking-[0.25em] border-b border-white/5 pb-3 mb-3">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        AI Analysis Live Log
                    </div>
                    <div className="min-h-[5rem] flex flex-col justify-end gap-1.5">
                        <AnimatePresence mode="popLayout">
                            {visibleLogs.map((line) => (
                                <motion.div
                                    key={line}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="text-blue-300/90"
                                >
                                    &gt; {line}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-8 font-bold">
                    Room {roomCode} · Verdict loading soon
                </p>
            </div>
        </div>
    );
};

export default EvaluationLobby;
