import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { toPng } from 'html-to-image';
import TeamShareCard from '../components/TeamShareCard';
import GlobalResultCard from '../components/GlobalResultCard';
import { X, AlertTriangle, CheckCircle2, Trophy, Shield, Star, Zap, Brain, Clock } from 'lucide-react';
import { fmtCr } from '../utils/playerUtils';
import Toast from '../components/Toast';

/* ─── helpers ─── */
const MetricBar = ({ label, value, color = '#D4AF37', max = 100 }) => {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                <span className="text-[11px] font-black font-mono" style={{ color }}>{value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 8px ${color}60` }}
                />
            </div>
        </div>
    );
};

const RankMedal = ({ rank }) => {
    if (rank === 1) return (
        <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/25 to-yellow-600/5 border border-yellow-500/40 px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.15)]">
            <span className="text-2xl">🥇</span>
            <div className="flex flex-col leading-none">
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-yellow-500/70">Champion</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400">WINNER</span>
            </div>
        </div>
    );
    if (rank === 2) return (
        <div className="flex items-center gap-2 bg-gradient-to-r from-slate-400/20 to-slate-500/5 border border-slate-400/30 px-3 py-1.5 rounded-xl">
            <span className="text-2xl">🥈</span>
            <div className="flex flex-col leading-none">
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400/70">Finalist</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">RUNNER UP</span>
            </div>
        </div>
    );
    if (rank === 3) return (
        <div className="flex items-center gap-2 bg-gradient-to-r from-orange-600/20 to-orange-700/5 border border-orange-600/30 px-3 py-1.5 rounded-xl">
            <span className="text-2xl">🥉</span>
            <div className="flex flex-col leading-none">
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-orange-500/70">Podium</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">3RD PLACE</span>
            </div>
        </div>
    );
    return (
        <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-50 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5" style={{ color: '#aaa' }}>
            #{rank} RANKED
        </span>
    );
};

const InfoCard = ({ label, value, accent = '#D4AF37', subtle = false }) => (
    <div className={`rounded-2xl border p-4 ${subtle ? 'bg-white/3 border-white/6' : 'bg-white/[0.04] border-white/8'}`}>
        <div className="text-[8px] font-black uppercase tracking-[0.35em] text-slate-500 mb-2">{label}</div>
        <div className="text-sm md:text-base font-bold leading-relaxed" style={{ color: accent }}>
            {value}
        </div>
    </div>
);

const ArrayChips = ({ items = [], emptyText = 'Not specified', tone = 'sky' }) => {
    const tones = {
        sky: 'bg-blue-500/10 border-blue-500/15 text-blue-100',
        violet: 'bg-violet-500/10 border-violet-500/15 text-violet-100',
        emerald: 'bg-emerald-500/10 border-emerald-500/15 text-emerald-100',
        amber: 'bg-amber-500/10 border-amber-500/15 text-amber-100',
        rose: 'bg-rose-500/10 border-rose-500/15 text-rose-100',
    };

    if (!items || items.length === 0) {
        return <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{emptyText}</span>;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
                <span
                    key={`${item}-${index}`}
                    className={`px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${tones[tone] || tones.sky}`}
                >
                    {item}
                </span>
            ))}
        </div>
    );
};

const normalizeEvaluation = (evaluation = {}) => {
    const playingXi = evaluation.playing_xi
        || evaluation.playing11
        || evaluation.homePlaying11
        || evaluation.awayPlaying11
        || [];

    const substitutes = evaluation.substitutes
        || evaluation.impactPlayers
        || evaluation.homeImpactPlayers
        || evaluation.awayImpactPlayers
        || [];

    const strengths = evaluation.strengths || [];
    const weaknesses = evaluation.weaknesses || [];
    const keyPlayers = evaluation.key_players || [evaluation.starPlayer].filter(Boolean);
    const summary = evaluation.summary || evaluation.tacticalVerdict || '';
    const rating = evaluation.rating ?? Math.round((evaluation.overallScore ?? 0) / 10);
    const auctionGrade = evaluation.auction_grade || (
        rating >= 9 ? 'S+' :
        rating >= 8 ? 'A+' :
        rating >= 7 ? 'A' :
        rating >= 6 ? 'B+' :
        rating >= 5 ? 'B' : 'C'
    );

    return {
        rating,
        playingXi,
        substitutes,
        strengths,
        weaknesses,
        keyPlayers,
        auctionGrade,
        summary,
    };
};

const ResultsReveal = () => {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [results, setResults] = useState([]);
    const [quizLeaderboard, setQuizLeaderboard] = useState(location.state?.quizLeaderboard || []);
    const [loading, setLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [error, setError] = useState(null);
    const [allPlayersMap, setAllPlayersMap] = useState({});
    const [isSharing, setIsSharing] = useState(false);
    const [toast, setToast] = useState(null);
    const [lineupTab, setLineupTab] = useState('home');
    const [roomCurrency, setRoomCurrency] = useState('inr');
    const [league, setLeague] = useState('ipl');
    const [showQuizLeaderboard, setShowQuizLeaderboard] = useState(false);

    const fmt = (lakhs) => fmtCr(lakhs, roomCurrency);

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${apiUrl}/api/players`)
            .then(res => res.json())
            .then(data => {
                const map = {};
                data.forEach(p => {
                    map[p._id] = p;
                    if (p.playerId) map[p.playerId] = p;
                });
                setAllPlayersMap(map);
            })
            .catch(err => console.error("Failed to fetch players for map:", err));
    }, []);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || '';
                const response = await fetch(`${apiUrl}/api/room/${roomCode}/results`);
                const data = await response.json();
                if (response.ok) {
                    const sorted = data.teams.sort((a, b) =>
                        (b.evaluation?.overallScore ?? 0) - (a.evaluation?.overallScore ?? 0)
                    );
                    sorted.forEach((t, i) => { t.rank = i + 1; });
                    setResults(sorted);
                    setRoomCurrency(data.currency || 'inr');
                    setLeague(data.league || 'ipl');
                    if (data.quizLeaderboard?.length) setQuizLeaderboard(data.quizLeaderboard);
                    setSelectedTeam(sorted[0]);
                    setLoading(false);
                } else {
                    setError(data.error);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error fetching results:', err);
                setError("Failed to reach server");
                setLoading(false);
            }
        };
        fetchResults();
    }, [roomCode]);

    const handleShareTeamCard = async () => {
        if (!selectedTeam || isSharing) return;
        setIsSharing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 800));
            const node = document.getElementById('team-share-card');
            if (!node) throw new Error("Share card element not found in DOM");
            const dataUrl = await toPng(node, {
                cacheBust: true,
                pixelRatio: 3,
                skipFonts: false,
                backgroundColor: selectedTeam.teamThemeColor || '#000000',
            });
            if (!dataUrl || dataUrl.length < 100) throw new Error("Generated image is empty or too small");
            const fileName = `${selectedTeam.teamName.replace(/\s+/g, '_')}_Squad.png`;
            const blobResponse = await fetch(dataUrl);
            const blob = await blobResponse.blob();
            const file = new File([blob], fileName, { type: 'image/png' });
            const shareData = {
                title: `${selectedTeam.teamName} Squad - Play Auction Verdict`,
                text: `Verified: My ${selectedTeam.teamName} squad! Final Score: ${selectedTeam.evaluation?.overallScore}/100. Star Player: ${selectedTeam.evaluation?.starPlayer}. #PlayAuctionVerdict`,
                files: [file]
            };
            if (navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
            } else {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                const whatsappMsg = encodeURIComponent(shareData.text);
                setTimeout(() => { window.open(`https://wa.me/?text=${whatsappMsg}`, '_blank'); }, 500);
            }
        } catch (err) {
            console.error("DEBUG: Sharing failed deeply:", err);
            setToast({ message: `Share failed: ${err.message || 'Unknown render error'}.`, type: 'error' });
        } finally {
            setTimeout(() => setIsSharing(false), 1200);
        }
    };

    const handleShareGlobalCard = async () => {
        if (!results || results.length === 0 || isSharing) return;
        setIsSharing(true);
        setToast({ message: "Preparing Global Verdict... Please wait.", type: 'success' });
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const node = document.getElementById('global-result-card');
            if (!node) throw new Error("Global share card element not found");
            const dataUrl = await toPng(node, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: '#0f3460',
                style: { transform: 'scale(1)', transformOrigin: 'top left' }
            });
            if (!dataUrl || dataUrl.length < 1000) throw new Error("Generated image is invalid");
            const fileName = `Play_2026_Final_Verdict.png`;
            const blobResponse = await fetch(dataUrl);
            const blob = await blobResponse.blob();
            const file = new File([blob], fileName, { type: 'image/png' });
            const shareData = {
                title: `Play Auction 2026 - Final Season Verdict`,
                text: `The Auction is Over! Here is the official AI Season Review. #PlayAuction #AuctionVerdict`,
                files: [file]
            };
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                try { await navigator.share(shareData); } catch (shareErr) { if (shareErr.name !== 'AbortError') throw shareErr; }
            } else {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setToast({ message: "Global Verdict saved to downloads!", type: 'success' });
            }
        } catch (err) {
            console.error("DEBUG: Global sharing failed:", err);
            setToast({ message: `Sharing failed: ${err.message || 'Unknown error'}`, type: 'error' });
        } finally {
            setTimeout(() => setIsSharing(false), 1200);
        }
    };

    /* ─── Loading State ─── */
    if (loading) return (
        <div className="min-h-screen bg-[#03060c] flex flex-col items-center justify-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 blur-[150px] rounded-full" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full" />
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-white/5 border-t-yellow-500 rounded-full mb-8 shadow-[0_0_30px_rgba(234,179,8,0.2)]"
            />
            <h2 className="text-xl font-black uppercase tracking-[0.3em] animate-pulse text-white">Gemini AI Evaluating Squads...</h2>
            <p className="text-slate-500 text-sm mt-2 font-bold uppercase tracking-widest">Analyzing Tactical Balance & Firepower</p>
        </div>
    );

    /* ─── Error State ─── */
    if (error) return (
        <div className="min-h-screen bg-[#03060c] flex flex-col items-center justify-center text-white">
            <h1 className="text-4xl font-black text-red-500 mb-4 uppercase tracking-tighter">Evaluation Error</h1>
            <p className="text-slate-400 mb-8">{error}</p>
            <button onClick={() => navigate('/')} className="btn-premium">Return Home</button>
        </div>
    );

    /* ─── Main Render ─── */
    return (
        <div className="min-h-screen bg-[#03060c] text-white p-4 sm:p-8 relative overflow-hidden font-sans">
            {/* Hidden share card containers */}
            <div style={{ position: 'fixed', left: '-3000px', top: '0', zIndex: -1, visibility: 'visible', pointerEvents: 'none' }}>
                <TeamShareCard team={selectedTeam} allPlayersMap={allPlayersMap} league={league} />
                <GlobalResultCard results={results} allPlayersMap={allPlayersMap} league={league} />
            </div>

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.008)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.008)_1px,transparent_1px)] bg-[size:5rem_5rem]" />
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-600/8 blur-[180px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/8 blur-[180px] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-yellow-500/3 blur-[200px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto">
                {/* ─── Page Header ─── */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 md:mb-14 gap-6">
                    <div className="w-full sm:w-auto">
                        <p className="text-[8px] md:text-[9px] font-black text-slate-600 uppercase tracking-[0.5em] mb-2">Auction Concluded · AI Season Review</p>
                        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black italic tracking-tighter uppercase leading-none">
                            The{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 drop-shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                                Verdict
                            </span>
                        </h1>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        {quizLeaderboard.length > 0 && (
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setShowQuizLeaderboard((prev) => !prev)}
                                className={`px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-[11px] border ${showQuizLeaderboard ? 'bg-violet-500/15 border-violet-500/30 text-violet-200' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`}
                            >
                                <Brain className="w-4 h-4" />
                                {showQuizLeaderboard ? 'Hide Quiz Leaderboard' : 'Quiz Leaderboard'}
                            </motion.button>
                        )}
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleShareGlobalCard}
                            disabled={isSharing}
                            className={`px-6 py-3.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-[#0a0700] rounded-2xl font-black uppercase tracking-widest shadow-[0_0_25px_rgba(212,175,55,0.2)] hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 text-[11px] ${isSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSharing ? <span className="animate-spin h-3 w-3 border-2 border-[#0a0700]/30 border-t-[#0a0700] rounded-full" /> : <Trophy className="w-4 h-4" />}
                            Global Verdict
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate('/')}
                            className="px-6 py-3.5 border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl hover:bg-white/10 transition-colors text-[11px] font-black uppercase tracking-widest"
                        >
                            Back to Lobby
                        </motion.button>
                    </div>
                </header>

                <AnimatePresence>
                    {showQuizLeaderboard && quizLeaderboard.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -12, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -12, height: 0 }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                            className="mb-8 overflow-hidden"
                        >
                            <div className="rounded-3xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 via-transparent to-amber-500/10 p-4 md:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
                                <div className="flex items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                                            <Brain className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-violet-300/80">Quiz Leaderboard</p>
                                            <p className="text-sm md:text-lg font-black uppercase">{quizLeaderboard[0]?.name || 'Top Scorer'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-center">
                                        <div>
                                            <div className="text-xl md:text-2xl font-black text-amber-400 font-mono">{quizLeaderboard[0]?.score ?? 0}</div>
                                            <div className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">Points</div>
                                        </div>
                                        <div>
                                            <div className="text-xl md:text-2xl font-black text-violet-300 font-mono">{quizLeaderboard[0]?.avgResponseSec ?? 0}s</div>
                                            <div className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">Avg Time</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {quizLeaderboard.slice(0, 5).map((player, idx) => (
                                        <div
                                            key={player.userId || player.name || idx}
                                            className={`flex items-center justify-between p-3 rounded-2xl border ${idx === 0 ? 'bg-amber-500/10 border-amber-500/25' : 'bg-white/[0.03] border-white/5'}`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${idx === 0 ? 'bg-amber-500 text-black' : 'bg-white/10 text-white'}`}>
                                                    {player.rank || idx + 1}
                                                </span>
                                                <span className="text-xs md:text-sm font-bold truncate">{player.name}</span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-xs md:text-sm font-black text-amber-400 font-mono">{player.score}pt</div>
                                                <div className="text-[8px] text-slate-500 flex items-center gap-0.5 justify-end">
                                                    <Clock className="w-2.5 h-2.5" />{player.avgResponseSec}s
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[8px] text-slate-500 text-center mt-3 uppercase tracking-wider">Ties broken by fastest avg time</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {(() => {
                    const isMathFallback = results.some(r => r.evaluation?.tacticalVerdict?.includes('Math Fallback'));
                    if (isMathFallback) {
                        return (
                            <div className="w-full flex justify-center mt-4">
                                <div className="scale-[0.6] sm:scale-[0.8] lg:scale-100 origin-top">
                                    <GlobalResultCard results={results} allPlayersMap={allPlayersMap} league={league} />
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">

                            {/* ─── LEFT: Rankings + Quiz Board ─── */}
                            <div className="lg:col-span-3 space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] mb-4 ml-1">Final Rankings</h3>
                                {results.map((team, index) => {
                                    const isSelected = selectedTeam?.teamId === team.teamId;
                                    const isChampion = team.rank === 1;
                                    const score = team.evaluation?.overallScore ?? 0;
                                    const isDisqualified = score === 0;

                                    return (
                                        <motion.div
                                            key={team.teamId || team.teamName || index}
                                            initial={{ x: -40, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                                            onClick={() => setSelectedTeam(team)}
                                            className={`
                                                relative p-4 rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden group
                                                ${isSelected
                                                    ? 'border-white/20 bg-white/8 shadow-[0_0_30px_rgba(255,255,255,0.05)] scale-[1.02]'
                                                    : 'border-white/5 bg-white/3 hover:bg-white/6 hover:border-white/10'
                                                }
                                                ${isChampion && isSelected ? 'border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.08)]' : ''}
                                            `}
                                        >
                                            {/* Team color left accent */}
                                            <div
                                                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all duration-300"
                                                style={{ backgroundColor: team.teamThemeColor, opacity: isSelected ? 1 : 0.4 }}
                                            />
                                            {/* Champion shimmer line */}
                                            {isChampion && (
                                                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-yellow-500/60 to-transparent" />
                                            )}

                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="mb-2">
                                                        {isDisqualified
                                                            ? <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">❌ Disqualified</span>
                                                            : <RankMedal rank={team.rank} />
                                                        }
                                                    </div>
                                                    <div className="text-base font-black uppercase tracking-tight truncate">{team.teamName}</div>
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">{team.ownerName}</div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div
                                                        className="text-3xl font-black font-mono leading-none"
                                                        style={{ color: isDisqualified ? '#ef4444' : team.teamThemeColor, textShadow: `0 0 20px ${team.teamThemeColor}50` }}
                                                    >
                                                        {score}
                                                    </div>
                                                    <div className="text-[7px] font-black text-slate-600 uppercase tracking-widest mt-0.5">AI Score</div>
                                                </div>
                                            </div>

                                            {/* Mini score bar */}
                                            {!isDisqualified && (
                                                <div className="mt-3 h-0.5 rounded-full bg-white/5 overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${score}%` }}
                                                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 + 0.3 }}
                                                        className="h-full rounded-full"
                                                        style={{ background: team.teamThemeColor }}
                                                    />
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>

                            </div>

                            {/* ─── RIGHT: Squad Detail Card ─── */}
                            <div className="lg:col-span-9">
                                <AnimatePresence mode="wait">
                                    {selectedTeam ? (
                                        <motion.div
                                            key={selectedTeam.teamId}
                                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.97 }}
                                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                            className="relative bg-slate-950/70 backdrop-blur-xl border border-white/8 rounded-[32px] md:rounded-[40px] p-5 md:p-8 shadow-[0_40px_80px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
                                        >
                                            {/* Top shimmer line */}
                                            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                            <div className="absolute top-0 inset-x-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${selectedTeam.teamThemeColor}50, transparent)` }} />

                                            {/* ─── AI Summary Header ─── */}
                                            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-5 mb-6">
                                                <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 md:p-6">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: selectedTeam.teamThemeColor, boxShadow: `0 0 15px ${selectedTeam.teamThemeColor}60` }} />
                                                                <div className="min-w-0">
                                                                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter italic truncate">{selectedTeam.teamName}</h2>
                                                                    <p className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-500 mt-1">{selectedTeam.ownerName}</p>
                                                                </div>
                                                            </div>
                                                            {normalizeEvaluation(selectedTeam.evaluation).summary && (
                                                                <p className="text-slate-300 font-bold leading-relaxed text-[11px] md:text-xs max-w-3xl">
                                                                    {normalizeEvaluation(selectedTeam.evaluation).summary}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                                            <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-[0.35em] text-slate-300">
                                                                AI Grade
                                                            </div>
                                                            <div className="text-4xl font-black font-mono leading-none" style={{ color: selectedTeam.teamThemeColor }}>
                                                                {normalizeEvaluation(selectedTeam.evaluation).rating}
                                                                <span className="text-lg text-slate-500">/10</span>
                                                            </div>
                                                            <div className="px-4 py-1.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-[10px] font-black uppercase tracking-[0.3em]">
                                                                {normalizeEvaluation(selectedTeam.evaluation).auctionGrade}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 mt-5">
                                                        <InfoCard label="Key Players" value={
                                                            <div className="flex flex-wrap gap-2">
                                                                {normalizeEvaluation(selectedTeam.evaluation).keyPlayers.length ? normalizeEvaluation(selectedTeam.evaluation).keyPlayers.map((item, idx) => (
                                                                    <span key={`${item}-${idx}`} className="px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/15 text-[10px] font-black uppercase tracking-wider text-yellow-200">
                                                                        {item}
                                                                    </span>
                                                                )) : 'Not specified'}
                                                            </div>
                                                        } accent={selectedTeam.teamThemeColor} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <InfoCard label="Rating" value={`${normalizeEvaluation(selectedTeam.evaluation).rating}/10`} accent={selectedTeam.teamThemeColor} />
                                                    <InfoCard label="Auction Grade" value={normalizeEvaluation(selectedTeam.evaluation).auctionGrade || '—'} accent="#fbbf24" />
                                                    <InfoCard label="Playing XI" value={`${normalizeEvaluation(selectedTeam.evaluation).playingXi.length} Selected`} accent="#60a5fa" />
                                                    <InfoCard label="Substitutes" value={`${normalizeEvaluation(selectedTeam.evaluation).substitutes.length} Listed`} accent="#a78bfa" />
                                                </div>
                                            </div>

                                            {/* ─── AI Output Sections ─── */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                                                <div className="rounded-3xl border border-blue-500/10 bg-blue-500/5 p-5">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-blue-300">Playing XI</h4>
                                                        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-300/40">Best XI</span>
                                                    </div>
                                                    <ArrayChips items={normalizeEvaluation(selectedTeam.evaluation).playingXi} emptyText="No playing XI returned" tone="sky" />
                                                </div>

                                                <div className="rounded-3xl border border-violet-500/10 bg-violet-500/5 p-5">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-violet-300">Substitutes</h4>
                                                        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-violet-300/40">4 Impact Subs</span>
                                                    </div>
                                                    <ArrayChips items={normalizeEvaluation(selectedTeam.evaluation).substitutes} emptyText="No substitutes returned" tone="violet" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                                <div className="rounded-3xl border border-emerald-500/10 bg-emerald-500/5 p-5">
                                                    <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-emerald-300 mb-3">Strengths</h4>
                                                    <ArrayChips items={normalizeEvaluation(selectedTeam.evaluation).strengths} emptyText="No strengths returned" tone="emerald" />
                                                </div>
                                                <div className="rounded-3xl border border-rose-500/10 bg-rose-500/5 p-5">
                                                    <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-rose-300 mb-3">Weaknesses</h4>
                                                    <ArrayChips items={normalizeEvaluation(selectedTeam.evaluation).weaknesses} emptyText="No weaknesses returned" tone="rose" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4 mb-6">
                                                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                                                    <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400 mb-3">AI Summary</h4>
                                                    <p className="text-[12px] md:text-[13px] text-slate-200 leading-relaxed font-medium">
                                                        {normalizeEvaluation(selectedTeam.evaluation).summary || 'No summary returned by the AI.'}
                                                    </p>
                                                </div>

                                                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Top Squad View</h4>
                                                        <button
                                                            onClick={handleShareTeamCard}
                                                            disabled={isSharing}
                                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 bg-white/5 hover:bg-white/10 transition-all ${isSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            Share
                                                        </button>
                                                    </div>
                                                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar grid grid-cols-1 gap-2 pr-1">
                                                        {(selectedTeam.playersAcquired || []).map((entry, idx) => (
                                                            <div
                                                                key={entry.player?._id || entry.player || idx}
                                                                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center font-black text-[9px] text-slate-500 border border-white/5 shrink-0">
                                                                        {idx + 1}
                                                                    </div>
                                                                    <div className="text-[11px] font-bold text-white truncate max-w-[180px]">
                                                                        {entry.name || (entry.player && allPlayersMap[entry.player]) || (entry.player?.name) || (allPlayersMap[entry.player?._id]) || "Unknown Player"}
                                                                    </div>
                                                                </div>
                                                                <div className="text-[10px] font-mono font-black text-slate-400">{fmt(entry.boughtFor)}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
        </div>
    );
};

export default ResultsReveal;
