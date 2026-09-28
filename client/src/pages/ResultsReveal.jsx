import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { toPng } from 'html-to-image';
import TeamShareCard from '../components/TeamShareCard';
import GlobalResultCard from '../components/GlobalResultCard';
import CustomLineupModal from '../components/CustomLineupModal';
import { X, AlertTriangle, CheckCircle2, Trophy, Shield, Star, Zap, Brain, Clock, Award, Flame, TrendingUp, AlertOctagon, ArrowRight, Sparkles, ShieldCheck, ShieldAlert, Sliders } from 'lucide-react';
import { fmtCr, LEAGUE_DEFAULTS } from '../utils/playerUtils';
import { getTeamLogoUrl } from '../utils/teamLogos';
import Toast from '../components/Toast';

/* ─── helpers ─── */
const getRankBadgeInfo = (rank) => {
    if (rank === 1) return { label: '🏆 Champions / Title Favourite', bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300' };
    if (rank === 2) return { label: '🥈 Finalist Contender', bg: 'bg-slate-300/10 border-slate-300/30 text-slate-200' };
    if (rank === 3) return { label: '🥉 3rd Place (Playoffs)', bg: 'bg-amber-700/10 border-amber-600/30 text-amber-200' };
    if (rank === 4) return { label: '🎯 4th Place (Playoffs Qualifier)', bg: 'bg-blue-500/10 border-blue-500/30 text-blue-300' };
    return { label: `📉 ${rank}th Place (Eliminated)`, bg: 'bg-rose-500/10 border-rose-500/30 text-rose-300' };
};

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

    const disqualificationReason = evaluation.disqualificationReason
        || (evaluation.analysis?.batting_narrative?.startsWith('DISQUALIFIED') ? evaluation.analysis.batting_narrative : null);
    const fixMessage = evaluation.analysis?.key_risks_and_fixes || null;

    const strengths = evaluation.strengths && evaluation.strengths.length > 0
        ? evaluation.strengths
        : (disqualificationReason ? ['Roster rule violation'] : []);
    const weaknesses = evaluation.weaknesses && evaluation.weaknesses.length > 0
        ? evaluation.weaknesses
        : (disqualificationReason ? [disqualificationReason, fixMessage].filter(Boolean) : []);
    const keyPlayers = evaluation.key_players || [evaluation.starPlayer].filter(Boolean);
    const summary = evaluation.summary || evaluation.broad_summary || evaluation.tacticalVerdict || disqualificationReason || '';
    const rating = evaluation.overallScore ?? evaluation.rating ?? Math.round((evaluation.overallScore ?? 0) / 10);
    const auctionGrade = evaluation.auction_grade || (
        disqualificationReason ? 'D' :
        rating >= 90 ? 'A+' :
        rating >= 80 ? 'A' :
        rating >= 70 ? 'B+' :
        rating >= 60 ? 'B' :
        rating >= 50 ? 'C' : 'D'
    );

    const parseBuy = (buy) => {
        if (!buy) return null;
        if (typeof buy === 'object') {
            const p = buy.player || buy.name;
            if (!p || p === 'None Identified' || p === 'N/A') return null;
            return {
                player: p,
                price: buy.price && buy.price !== 'N/A' ? `${buy.price}` : '',
                rationale: buy.rationale || buy.analysis || buy.reason || ''
            };
        }
        if (typeof buy === 'string') {
            if (!buy || buy === 'None Identified' || buy === 'N/A') return null;
            const match = buy.match(/^([^(]+)(?:\(([^)]+)\))?\s*(?:[-–:]\s*(.*))?$/);
            if (match) {
                return {
                    player: (match[1] || buy).trim(),
                    price: (match[2] || '').trim(),
                    rationale: (match[3] || '').trim()
                };
            }
            return { player: buy, price: '', rationale: '' };
        }
        return null;
    };

    const bestBuy = parseBuy(evaluation.best_buy);
    const stealOfAuction = parseBuy(evaluation.steal_of_auction) || (evaluation.bestValuePick ? parseBuy(evaluation.bestValuePick) : null);
    const worstBuy = parseBuy(evaluation.worst_buy);

    const benchReplacements = Array.isArray(evaluation.bench_like_for_like_replacements)
        ? evaluation.bench_like_for_like_replacements
        : [];

    const phaseRatings = evaluation.phase_ratings || null;
    const pitchSuitability = evaluation.pitch_suitability || null;
    const tournamentProjection = evaluation.tournament_projection || null;
    const squadMetrics = evaluation.squad_metrics || null;
    const missingRoles = Array.isArray(evaluation.missing_roles) ? evaluation.missing_roles : [];
    const overpaidPlayers = Array.isArray(evaluation.overpaid_players) ? evaluation.overpaid_players.map(parseBuy).filter(Boolean) : [];

    return {
        rating,
        playingXi,
        substitutes,
        strengths,
        weaknesses,
        keyPlayers,
        auctionGrade,
        summary,
        bestBuy,
        stealOfAuction,
        worstBuy,
        benchReplacements,
        phaseRatings,
        pitchSuitability,
        tournamentProjection,
        squadMetrics,
        missingRoles,
        overpaidPlayers,
        disqualificationReason,
        fixMessage
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
    const [showCustomLineupModal, setShowCustomLineupModal] = useState(false);

    const fmt = (lakhs) => fmtCr(lakhs, roomCurrency, LEAGUE_DEFAULTS[league] || 'inr');

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

                                            <div className="flex justify-between items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white p-1 shrink-0 flex items-center justify-center shadow-md border border-white/20">
                                                    <img
                                                        src={getTeamLogoUrl(team.teamName, league, team.logoUrl)}
                                                        alt={team.teamName}
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="mb-1.5">
                                                        {isDisqualified
                                                            ? <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">❌ Disqualified</span>
                                                            : <RankMedal rank={team.rank} />
                                                        }
                                                    </div>
                                                    <div className="text-sm font-black uppercase tracking-tight truncate">{team.teamName}</div>
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
                                    {selectedTeam ? (() => {
                                        const evalData = normalizeEvaluation(selectedTeam.evaluation);
                                        const summaryParas = (evalData.summary || '')
                                            .split(/\n+/)
                                            .map(p => p.trim())
                                            .filter(Boolean);

                                        return (
                                            <motion.div
                                                key={selectedTeam.teamId}
                                                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.97 }}
                                                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                                className="relative bg-slate-950/70 backdrop-blur-xl border border-white/8 rounded-[32px] md:rounded-[40px] p-5 md:p-8 shadow-[0_40px_80px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col gap-6"
                                            >
                                                {/* Top shimmer line */}
                                                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                                <div className="absolute top-0 inset-x-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${selectedTeam.teamThemeColor}50, transparent)` }} />

                                                {/* ─── Disqualification Notice Banner (if disqualified) ─── */}
                                                {(evalData.disqualificationReason || selectedTeam.evaluation?.overallScore === 0) && (
                                                    <div className="rounded-[24px] border border-red-500/40 bg-red-500/10 p-5 flex items-start gap-4 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
                                                        <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 text-red-400 mt-0.5">
                                                            <AlertTriangle className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/30">
                                                                    Squad Disqualified
                                                                </span>
                                                                <span className="text-[9px] font-bold uppercase tracking-wider text-red-300/60">
                                                                    Score: 0/100
                                                                </span>
                                                            </div>
                                                            <div className="text-sm sm:text-base font-bold text-red-100 mt-1.5 leading-snug">
                                                                {evalData.disqualificationReason || selectedTeam.evaluation?.analysis?.batting_narrative || "Squad failed key roster eligibility rules."}
                                                            </div>
                                                            {evalData.fixMessage && (
                                                                <div className="text-xs text-red-300 font-medium mt-1.5 flex items-center gap-1.5">
                                                                    <span className="font-bold uppercase tracking-wider text-[10px] bg-red-500/20 px-1.5 py-0.5 rounded text-red-300">How to Fix</span>
                                                                    <span>{evalData.fixMessage}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ─── AI Header & Core Grade ─── */}
                                                <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 md:p-6">
                                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-3.5 mb-2">
                                                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shrink-0 flex items-center justify-center shadow-lg border border-white/20">
                                                                    <img
                                                                        src={getTeamLogoUrl(selectedTeam.teamName, league, selectedTeam.logoUrl)}
                                                                        alt={selectedTeam.teamName}
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter italic truncate">{selectedTeam.teamName}</h2>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">👑 {selectedTeam.ownerName}</span>
                                                                        {selectedTeam.rank && (() => {
                                                                            const badge = getRankBadgeInfo(selectedTeam.rank);
                                                                            return (
                                                                                <span className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                                                                                    {badge.label}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                                                            <div className="flex flex-col items-end">
                                                                <div className="text-4xl font-black font-mono leading-none" style={{ color: selectedTeam.teamThemeColor }}>
                                                                    {evalData.rating}
                                                                    <span className="text-lg text-slate-500">/100</span>
                                                                </div>
                                                                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">AI Composite Score</div>
                                                            </div>
                                                            <div className="flex flex-col items-center justify-center px-4 py-2 rounded-2xl border border-amber-500/30 bg-amber-500/10">
                                                                <span className="text-[7px] font-black uppercase tracking-widest text-amber-400/80">Grade</span>
                                                                <span className="text-xl font-black text-amber-300 leading-none">{evalData.auctionGrade}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Key Players & Custom Lineup Action */}
                                                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-white/5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">Key Match-Winners:</span>
                                                            {evalData.keyPlayers.length ? evalData.keyPlayers.map((item, idx) => (
                                                                <span key={`${item}-${idx}`} className="px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-black uppercase tracking-wider text-yellow-200">
                                                                    ⭐ {item}
                                                                </span>
                                                            )) : <span className="text-[10px] text-slate-500">Core starters</span>}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {selectedTeam.evaluation?.customLineupApplied && (
                                                                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                                                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                                    Custom XI Evaluated
                                                                </span>
                                                            )}
                                                            <button
                                                                onClick={() => setShowCustomLineupModal(true)}
                                                                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-purple-500/20 hover:from-amber-500/30 hover:via-orange-500/30 hover:to-purple-500/30 border border-amber-500/40 hover:border-amber-400/60 text-amber-200 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:scale-[1.02]"
                                                            >
                                                                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                                                                <span>Customize XI & Re-Evaluate</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ─── Metric Pills Row ─── */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    <InfoCard label="Squad Balance" value={`${evalData.squadMetrics?.balance_score ?? evalData.rating}/100`} accent="#34d399" />
                                                    <InfoCard label="Star Power" value={`${evalData.squadMetrics?.star_power_score ?? evalData.rating}/100`} accent="#f59e0b" />
                                                    <InfoCard label="Playing XI" value={`${evalData.playingXi.length} Starters`} accent="#60a5fa" />
                                                    <InfoCard label="Bench Depth" value={`${evalData.squadMetrics?.bench_depth_score ?? 70}/100`} accent="#a78bfa" />
                                                </div>

                                                {/* ─── AUCTION VALUATION CORNER (Steal Buy, Best Buy, Worst/Overpriced Buy) ─── */}
                                                {(evalData.stealOfAuction || evalData.bestBuy || evalData.worstBuy) && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {evalData.stealOfAuction && (
                                                            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-4 flex flex-col justify-between">
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-1.5 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                                                                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                                                            Steal of Auction
                                                                        </div>
                                                                        {evalData.stealOfAuction.price && (
                                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-[9px] font-mono font-black text-emerald-300">
                                                                                {evalData.stealOfAuction.price}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-sm font-black text-white">{evalData.stealOfAuction.player}</div>
                                                                    {evalData.stealOfAuction.rationale && (
                                                                        <p className="text-[11px] text-emerald-200/80 font-medium mt-1 leading-snug">
                                                                            {evalData.stealOfAuction.rationale}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {evalData.bestBuy && (
                                                            <div className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-4 flex flex-col justify-between">
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-1.5 text-amber-400 text-[9px] font-black uppercase tracking-widest">
                                                                            <Award className="w-3.5 h-3.5 text-amber-400" />
                                                                            Cornerstone Signing
                                                                        </div>
                                                                        {evalData.bestBuy.price && (
                                                                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[9px] font-mono font-black text-amber-300">
                                                                                {evalData.bestBuy.price}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-sm font-black text-white">{evalData.bestBuy.player}</div>
                                                                    {evalData.bestBuy.rationale && (
                                                                        <p className="text-[11px] text-amber-200/80 font-medium mt-1 leading-snug">
                                                                            {evalData.bestBuy.rationale}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {evalData.worstBuy && (
                                                            <div className="rounded-3xl border border-rose-500/25 bg-rose-500/5 p-4 flex flex-col justify-between">
                                                                <div>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-1.5 text-rose-400 text-[9px] font-black uppercase tracking-widest">
                                                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                                                            Overpriced / Risk Buy
                                                                        </div>
                                                                        {evalData.worstBuy.price && (
                                                                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-[9px] font-mono font-black text-rose-300">
                                                                                {evalData.worstBuy.price}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-sm font-black text-white">{evalData.worstBuy.player}</div>
                                                                    {evalData.worstBuy.rationale && (
                                                                        <p className="text-[11px] text-rose-200/80 font-medium mt-1 leading-snug">
                                                                            {evalData.worstBuy.rationale}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ─── MATCH PHASE RATINGS (0-10) ─── */}
                                                {evalData.phaseRatings && (
                                                    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-300 flex items-center gap-2">
                                                                <Flame className="w-4 h-4 text-orange-400" />
                                                                Match Phase Execution Ratings (0–10)
                                                            </h4>
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">20-Over Breakdown</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div className="rounded-2xl border border-blue-500/15 bg-blue-500/5 p-4">
                                                                <div className="flex justify-between items-center mb-1.5">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-300">Powerplay (Overs 1–6)</span>
                                                                    <span className="text-xs font-black font-mono text-blue-400">{evalData.phaseRatings.powerplay?.score ?? '—'}/10</span>
                                                                </div>
                                                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
                                                                    <div className="h-full rounded-full bg-blue-400" style={{ width: `${(evalData.phaseRatings.powerplay?.score || 0) * 10}%` }} />
                                                                </div>
                                                                <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                                                    {evalData.phaseRatings.powerplay?.analysis || 'Solid top-order intent and new-ball swing.'}
                                                                </p>
                                                            </div>

                                                            <div className="rounded-2xl border border-purple-500/15 bg-purple-500/5 p-4">
                                                                <div className="flex justify-between items-center mb-1.5">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-purple-300">Middle Overs (Overs 7–15)</span>
                                                                    <span className="text-xs font-black font-mono text-purple-400">{evalData.phaseRatings.middle_overs?.score ?? '—'}/10</span>
                                                                </div>
                                                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
                                                                    <div className="h-full rounded-full bg-purple-400" style={{ width: `${(evalData.phaseRatings.middle_overs?.score || 0) * 10}%` }} />
                                                                </div>
                                                                <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                                                    {evalData.phaseRatings.middle_overs?.analysis || 'Spin strangle and strike rotation control.'}
                                                                </p>
                                                            </div>

                                                            <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-4">
                                                                <div className="flex justify-between items-center mb-1.5">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-300">Death Overs (Overs 16–20)</span>
                                                                    <span className="text-xs font-black font-mono text-rose-400">{evalData.phaseRatings.death_overs?.score ?? '—'}/10</span>
                                                                </div>
                                                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
                                                                    <div className="h-full rounded-full bg-rose-400" style={{ width: `${(evalData.phaseRatings.death_overs?.score || 0) * 10}%` }} />
                                                                </div>
                                                                <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                                                    {evalData.phaseRatings.death_overs?.analysis || 'Boundary hitting & death yorker execution.'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ─── BENCH STRENGTH & LIKE-FOR-LIKE REPLACEMENTS ─── */}
                                                {evalData.benchReplacements && evalData.benchReplacements.length > 0 && (
                                                    <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-5">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-2">
                                                                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                                                <div>
                                                                    <h4 className="text-[10px] font-black uppercase tracking-[0.35em] text-indigo-300">Bench Strength & Like-for-Like Replacements</h4>
                                                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Injury Resilience & Depth Audit</p>
                                                                </div>
                                                            </div>
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                                {evalData.benchReplacements.length} Scenarios Analyzed
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {evalData.benchReplacements.map((item, idx) => {
                                                                const isElite = item.coverage_quality === 'Elite';
                                                                const isVulnerable = item.coverage_quality === 'Vulnerable';
                                                                const badgeBg = isElite
                                                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                                                    : isVulnerable
                                                                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                                                                        : 'bg-amber-500/15 border-amber-500/30 text-amber-300';

                                                                return (
                                                                    <div key={idx} className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5 hover:bg-white/[0.04] transition-colors">
                                                                        <div className="flex items-center justify-between gap-2 mb-2">
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <span className="text-xs font-black text-white truncate">{item.primary_player}</span>
                                                                                <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                                                                                <span className="text-xs font-bold text-slate-300 truncate">{item.backup_player}</span>
                                                                            </div>
                                                                            <span className={`px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider shrink-0 ${badgeBg}`}>
                                                                                {item.coverage_quality} Cover
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                                                                            Role: {item.role}
                                                                        </div>
                                                                        <p className="text-[11px] text-slate-300 font-medium leading-snug">
                                                                            {item.tactical_impact}
                                                                        </p>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ─── Playing XI & Impact Substitutes ─── */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                    <div className="rounded-3xl border border-blue-500/10 bg-blue-500/5 p-5">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-blue-300">Playing XI</h4>
                                                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-300/40">Best Starting 11</span>
                                                        </div>
                                                        <ArrayChips items={evalData.playingXi} emptyText="No playing XI returned" tone="sky" />
                                                    </div>

                                                    <div className="rounded-3xl border border-violet-500/10 bg-violet-500/5 p-5">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-violet-300">Substitutes & Impact Subs</h4>
                                                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-violet-300/40">Bench Reserves</span>
                                                        </div>
                                                        <ArrayChips items={evalData.substitutes} emptyText="No substitutes returned" tone="violet" />
                                                    </div>
                                                </div>

                                                {/* ─── Strengths & Weaknesses ─── */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="rounded-3xl border border-emerald-500/10 bg-emerald-500/5 p-5">
                                                        <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-emerald-300 mb-3 flex items-center gap-1.5">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                            Tactical Strengths
                                                        </h4>
                                                        <ArrayChips items={evalData.strengths} emptyText="No strengths returned" tone="emerald" />
                                                    </div>
                                                    <div className="rounded-3xl border border-rose-500/10 bg-rose-500/5 p-5">
                                                        <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-rose-300 mb-3 flex items-center gap-1.5">
                                                            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                                                            Tactical Weaknesses
                                                        </h4>
                                                        <ArrayChips items={evalData.weaknesses} emptyText="No weaknesses returned" tone="rose" />
                                                    </div>
                                                </div>

                                                {/* ─── Missing Roles & Pitch Adaptability (if any) ─── */}
                                                {(evalData.missingRoles.length > 0 || evalData.pitchSuitability?.verdict) && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {evalData.missingRoles.length > 0 && (
                                                            <div className="rounded-3xl border border-amber-500/15 bg-amber-500/5 p-5">
                                                                <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-amber-300 mb-3">
                                                                    Unaddressed Squad Gaps / Missing Roles
                                                                </h4>
                                                                <ArrayChips items={evalData.missingRoles} emptyText="No missing roles" tone="amber" />
                                                            </div>
                                                        )}
                                                        {evalData.pitchSuitability && (
                                                            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-300">
                                                                        Home Pitch Adaptability ({evalData.pitchSuitability.home_ground})
                                                                    </h4>
                                                                    <span className="text-[10px] font-mono font-black text-amber-300">
                                                                        {evalData.pitchSuitability.suitability_score}/10
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                                                                    {evalData.pitchSuitability.verdict}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ─── FULL-FLEDGED BROAD AI SCOUT REPORT ─── */}
                                                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
                                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Brain className="w-4 h-4 text-purple-400" />
                                                                    <h4 className="text-[10px] font-black uppercase tracking-[0.35em] text-white">Full-Fledged AI Scout Verdict</h4>
                                                                </div>
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Comprehensive Scout Analysis</span>
                                                            </div>

                                                            <div className="space-y-4">
                                                                {summaryParas.length > 0 ? (
                                                                    summaryParas.map((para, pIdx) => {
                                                                        const isLast = pIdx === summaryParas.length - 1;
                                                                        if (isLast && summaryParas.length >= 3) {
                                                                            return (
                                                                                <div key={pIdx} className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 mt-2">
                                                                                    <div className="text-[8px] font-black uppercase tracking-widest text-yellow-400 mb-1">
                                                                                        🎙️ TV Pundit Takeaway
                                                                                    </div>
                                                                                    <p className="text-xs sm:text-[13px] text-yellow-100 font-bold italic leading-relaxed">
                                                                                        "{para}"
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <p key={pIdx} className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
                                                                                {para}
                                                                            </p>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <p className="text-xs text-slate-400">No detailed summary available.</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {evalData.tournamentProjection && (
                                                            <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                                <div>Playoff Probability: <span className="text-emerald-400 font-mono text-[11px] ml-1">{evalData.tournamentProjection.playoff_probability || 'N/A'}</span></div>
                                                                <div>Title Outlook: <span className="text-amber-300 font-mono text-[11px] ml-1">{evalData.tournamentProjection.title_odds || 'Competitive'}</span></div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Top Squad View with Prices */}
                                                    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                                                <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-slate-400">Squad Roster ({selectedTeam.playersAcquired?.length || 0})</h4>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => setShowCustomLineupModal(true)}
                                                                        className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all flex items-center gap-1"
                                                                    >
                                                                        <Sliders className="w-3 h-3 text-amber-400" />
                                                                        Custom XI
                                                                    </button>
                                                                    <button
                                                                        onClick={handleShareTeamCard}
                                                                        disabled={isSharing}
                                                                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 bg-white/5 hover:bg-white/10 transition-all ${isSharing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                    >
                                                                        Share Card
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="max-h-[380px] overflow-y-auto custom-scrollbar grid grid-cols-1 gap-2 pr-1">
                                                                {(selectedTeam.playersAcquired || []).map((entry, idx) => (
                                                                    <div
                                                                        key={entry.player?._id || entry.player || idx}
                                                                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 transition-colors"
                                                                    >
                                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center font-black text-[9px] text-slate-500 border border-white/5 shrink-0">
                                                                                {idx + 1}
                                                                            </div>
                                                                            <div className="text-[11px] font-bold text-white truncate max-w-[150px]">
                                                                                {entry.name || (entry.player && allPlayersMap[entry.player]) || (entry.player?.name) || (allPlayersMap[entry.player?._id]) || "Unknown Player"}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-[10px] font-mono font-black text-slate-400">{fmt(entry.boughtFor)}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })() : null}
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Custom Lineup & Bench Selection Modal */}
            <CustomLineupModal
                isOpen={showCustomLineupModal}
                onClose={() => setShowCustomLineupModal(false)}
                team={selectedTeam}
                roomCode={roomCode}
                league={league}
                currency={roomCurrency}
                allPlayersMap={allPlayersMap}
                onEvaluationUpdated={(updatedTeam, allTeams) => {
                    if (allTeams && allTeams.length) {
                        setResults(allTeams);
                    }
                    if (updatedTeam) {
                        setSelectedTeam(updatedTeam);
                    }
                    setToast({
                        type: 'success',
                        message: `Lineup Re-Evaluated! New AI Score: ${updatedTeam?.evaluation?.overallScore ?? updatedTeam?.evaluation?.rating}/100`
                    });
                }}
            />

            <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
        </div>
    );
};

export default ResultsReveal;
