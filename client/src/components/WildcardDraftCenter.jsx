import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserCheck, ShieldAlert, Award, Star, X, Check, Eye } from 'lucide-react';

export default function WildcardDraftCenter({ gameState, myTeam, fmt, socket, roomCode, isHost }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRole, setSelectedRole] = useState('All');
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [showConfirmPick, setShowConfirmPick] = useState(false);
    const [showConfirmSkip, setShowConfirmSkip] = useState(false);

    // Roles formatting to align with schema
    const ROLES = ['All', 'Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];

    const unsoldPlayers = useMemo(() => {
        return gameState?.wildcardUnsoldPlayers || [];
    }, [gameState?.wildcardUnsoldPlayers]);

    const picks = useMemo(() => {
        return gameState?.wildcardPicks || {};
    }, [gameState?.wildcardPicks]);

    const skips = useMemo(() => {
        return gameState?.wildcardSkips || {};
    }, [gameState?.wildcardSkips]);

    const teams = useMemo(() => {
        return gameState?.teams || [];
    }, [gameState?.teams]);

    // Format role for matching
    const matchesRole = (playerRole, selected) => {
        if (selected === 'All') return true;
        const pRole = (playerRole || '').toLowerCase().replace('-', '').replace('s', '');
        const sRole = selected.toLowerCase().replace('-', '').replace('s', '');
        return pRole === sRole || (sRole === 'allrounder' && pRole === 'allrounder');
    };

    const filteredPlayers = useMemo(() => {
        return unsoldPlayers.filter(p => {
            const name = (p.name || p.player || '').toLowerCase();
            const query = searchQuery.toLowerCase();
            const matchesSearch = name.includes(query);
            const matchesCategory = matchesRole(p.role, selectedRole);
            return matchesSearch && matchesCategory;
        });
    }, [unsoldPlayers, searchQuery, selectedRole]);

    // Check my draft eligibility
    const squadSize = myTeam?.playersAcquired?.length || 0;
    const maxSquad = 20;
    const hasSpace = squadSize < maxSquad;
    const hasPicked = myTeam ? !!picks[myTeam.teamName] : false;
    const hasSkipped = myTeam ? !!skips[myTeam.teamName] : false;
    const isDone = hasPicked || hasSkipped || !hasSpace;

    const myDraftStatus = useMemo(() => {
        if (!myTeam) return { eligible: false, message: 'You are not managing a team in this room.' };
        if (hasPicked) {
            const pickedPlayerId = picks[myTeam.teamName];
            const playerDetails = myTeam.playersAcquired?.find(p => String(p._id) === String(pickedPlayerId) || String(p.playerId) === String(pickedPlayerId));
            return { eligible: false, message: `Completed: Drafted ${playerDetails?.name || 'Wildcard player'}.` };
        }
        if (hasSkipped) return { eligible: false, message: 'Completed: Skipped Wildcard choice.' };
        if (!hasSpace) return { eligible: false, message: `Ineligible: Squad is full (20/20).` };
        return { eligible: true, message: 'Eligible: Choose one player to draft.' };
    }, [myTeam, hasPicked, hasSkipped, hasSpace, picks]);

    const handlePickPlayerClick = (player) => {
        const cost = player.basePrice || 50;
        if ((myTeam?.currentPurse || 0) < cost) {
            alert(`Insufficient budget to draft ${player.name || player.player}. Needs R${cost}L, available R${myTeam.currentPurse}L.`);
            return;
        }
        setSelectedPlayer(player);
        setShowConfirmPick(true);
    };

    const handleConfirmPick = () => {
        if (!selectedPlayer || !myTeam) return;
        socket.emit('pick_wildcard_player', {
            roomCode,
            playerId: selectedPlayer._id || selectedPlayer.playerId,
            teamName: myTeam.teamName
        });
        setShowConfirmPick(false);
        setSelectedPlayer(null);
    };

    const handleConfirmSkip = () => {
        if (!myTeam) return;
        socket.emit('skip_wildcard', {
            roomCode,
            teamName: myTeam.teamName
        });
        setShowConfirmSkip(false);
    };

    const handleForceEnd = () => {
        if (window.confirm('Are you sure you want to end the wildcard draft phase? Human teams who haven\'t drafted yet will skip.')) {
            socket.emit('complete_wildcard_phase', { roomCode });
        }
    };

    // Helper to determine status label for other teams
    const getTeamStatusLabel = (team) => {
        if (picks[team.teamName]) {
            // Find player name
            const pId = picks[team.teamName];
            const p = team.playersAcquired?.find(pa => String(pa._id) === String(pId) || String(pa.playerId) === String(pId));
            return {
                text: p ? `Picked: ${p.name}` : 'Drafted',
                style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            };
        }
        if (skips[team.teamName]) {
            return {
                text: 'Skipped',
                style: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
            };
        }
        const curSquadCount = team.playersAcquired?.length || 0;
        if (curSquadCount >= maxSquad) {
            return {
                text: 'Full Squad',
                style: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            };
        }
        // Check if they can afford the cheapest unsold player
        const cheapestPlayerCost = unsoldPlayers.length > 0 
            ? Math.min(...unsoldPlayers.map(p => p.basePrice || 20)) 
            : 20;
        if (team.currentPurse < cheapestPlayerCost) {
            return {
                text: 'No Budget',
                style: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            };
        }
        return {
            text: 'Drafting...',
            style: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
        };
    };

    return (
        <div className="min-h-screen bg-[#060a13] text-white flex flex-col font-sans selection:bg-blue-500/30 overflow-y-auto" style={{ background: 'linear-gradient(135deg, #090e18 0%, #03060c 100%)' }}>
            {/* Top Navigation Banner */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-wider bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            SA20 Wildcard Entry Draft
                        </h1>
                        <p className="text-xs text-slate-400">Sign one final wildcard player to finalize your team roster</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* User's Team Status Quick View */}
                    {myTeam && (
                        <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 flex items-center gap-4">
                            <div>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Your Purse</span>
                                <span className="text-sm font-black text-amber-400">{fmt(myTeam.currentPurse)}</span>
                            </div>
                            <div className="w-px h-6 bg-white/10" />
                            <div>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Squad size</span>
                                <span className="text-sm font-black text-slate-200">{squadSize} / {maxSquad}</span>
                            </div>
                        </div>
                    )}

                    {/* Host Forces Completion */}
                    {isHost && (
                        <button
                            id="wildcard-host-end"
                            onClick={handleForceEnd}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95"
                        >
                            Force End Phase
                        </button>
                    )}
                </div>
            </header>

            {/* Main Interactive Grid */}
            <main className="flex-1 max-w-[1400px] w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Area: Unsold Players Explorer (3/4 width) */}
                <section className="lg:col-span-3 flex flex-col gap-6">
                    {/* Filter & Search Bar Card */}
                    <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between backdrop-blur-sm">
                        {/* Search Input */}
                        <div className="relative w-full md:w-80">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                id="wildcard-search"
                                type="text"
                                placeholder="Search unsold players..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none rounded-xl pl-9 pr-4 py-2 text-sm text-white transition-all placeholder:text-slate-500"
                            />
                        </div>

                        {/* Category filter tabs */}
                        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto p-1 bg-black/20 rounded-xl border border-white/5">
                            {ROLES.map(role => (
                                <button
                                    key={role}
                                    id={`wildcard-role-${role.toLowerCase()}`}
                                    onClick={() => setSelectedRole(role)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${selectedRole === role ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Roster Alerts / Instructions */}
                    <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${myDraftStatus.eligible ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                            <p className="text-xs font-medium">{myDraftStatus.message}</p>
                        </div>
                        {myDraftStatus.eligible && !isDone && (
                            <button
                                id="wildcard-skip-btn"
                                onClick={() => setShowConfirmSkip(true)}
                                className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase transition-all"
                            >
                                Skip Selection
                            </button>
                        )}
                    </div>

                    {/* Grid of Players */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <AnimatePresence mode="popLayout">
                            {filteredPlayers.length > 0 ? (
                                filteredPlayers.map(player => {
                                    const canAfford = (myTeam?.currentPurse || 0) >= (player.basePrice || 50);
                                    return (
                                        <motion.div
                                            key={player._id || player.playerId}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden hover:border-white/15 transition-all group flex flex-col relative"
                                        >
                                            {/* Top Player Branding */}
                                            <div className="h-32 bg-gradient-to-b from-blue-900/10 to-transparent relative p-4 flex items-end">
                                                {/* Overseas Badge */}
                                                {player.isOverseas && (
                                                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-widest">
                                                        Overseas
                                                    </span>
                                                )}

                                                <div className="absolute top-3 left-3 bg-white/5 border border-white/10 rounded-lg p-1.5 flex items-center gap-1">
                                                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                                                    <span className="text-[10px] font-bold text-slate-200">{player.points || 0} pts</span>
                                                </div>

                                                {/* Image Placeholder */}
                                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center z-10">
                                                    {player.photoUrl ? (
                                                        <img src={player.photoUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                    ) : (
                                                        <span className="text-xl font-bold text-slate-500">
                                                            {player.name ? player.name[0] : '?'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Details Body */}
                                            <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                                                <div>
                                                    <h3 className="font-bold text-sm text-slate-100 line-clamp-1 group-hover:text-blue-400 transition-colors">
                                                        {player.name || player.player}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{player.role}</span>
                                                        <span className="text-[10px] text-slate-500">•</span>
                                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{player.nationality}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                                    <div>
                                                        <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">Base Price</span>
                                                        <span className="text-sm font-black text-amber-400">R{player.basePrice}L</span>
                                                    </div>

                                                    {myDraftStatus.eligible && !isDone ? (
                                                        <button
                                                            id={`draft-btn-${player._id || player.playerId}`}
                                                            onClick={() => handlePickPlayerClick(player)}
                                                            disabled={!canAfford}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${canAfford ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/20 active:scale-95' : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'}`}
                                                        >
                                                            {canAfford ? 'Draft Player' : 'Too Costly'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-600">
                                                            Unavailable
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            ) : (
                                <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-white/5 rounded-2xl">
                                    <ShieldAlert className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                                    <p className="text-sm font-bold uppercase tracking-widest">No matching unsold players found</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </section>

                {/* Right Area: Franchise Board Status (1/4 width) */}
                <aside className="bg-black/30 border border-white/5 rounded-3xl p-4 flex flex-col gap-6 backdrop-blur-sm self-start h-full">
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 mb-1">Franchise Draft Status</h2>
                        <p className="text-[10px] text-slate-500">Track selections across teams in real-time</p>
                    </div>

                    <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px]">
                        {teams.map(t => {
                            const isMe = myTeam && t.teamName === myTeam.teamName;
                            const status = getTeamStatusLabel(t);
                            const sqSize = t.playersAcquired?.length || 0;

                            return (
                                <div
                                    key={t.teamName}
                                    className={`p-3 rounded-2xl border transition-all ${isMe ? 'bg-blue-500/5 border-blue-500/30 shadow-md shadow-blue-500/5' : 'bg-white/5 border-white/5'}`}
                                >
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2 truncate">
                                            {t.teamLogo ? (
                                                <img src={t.teamLogo} alt="" className="w-6 h-6 object-contain" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{ backgroundColor: t.teamThemeColor || '#333' }}>
                                                    {t.teamName[0]}
                                                </div>
                                            )}
                                            <span className={`text-xs font-bold truncate ${isMe ? 'text-blue-300' : 'text-slate-300'}`}>
                                                {t.teamName} {isMe && '(You)'}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{sqSize} / {maxSquad}</span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold text-slate-500">{fmt(t.currentPurse)} left</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-black border tracking-wider max-w-[120px] truncate ${status.style}`}>
                                            {status.text}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>
            </main>

            {/* CONFIRM DRAFT MODAL */}
            <AnimatePresence>
                {showConfirmPick && selectedPlayer && (
                    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowConfirmPick(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />

                        {/* Modal Box */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#0b121f] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10"
                        >
                            <div className="p-6">
                                <h3 className="text-lg font-black uppercase tracking-wider mb-2">Confirm Wildcard Signing</h3>
                                <p className="text-xs text-slate-400 mb-6">
                                    You are signing <span className="font-bold text-blue-400">{selectedPlayer.name || selectedPlayer.player}</span> to your squad. The base price of <span className="font-bold text-amber-400">R{selectedPlayer.basePrice}L</span> will be deducted from your remaining budget.
                                </p>

                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between mb-6">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Remaining budget after draft</span>
                                        <span className="text-base font-black text-amber-400">
                                            {fmt((myTeam?.currentPurse || 0) - (selectedPlayer.basePrice || 50))}
                                        </span>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-400">
                                        <UserCheck className="w-5 h-5" />
                                    </div>
                                </div>

                                <div className="flex gap-3 justify-end">
                                    <button
                                        id="confirm-pick-cancel"
                                        onClick={() => setShowConfirmPick(false)}
                                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        id="confirm-pick-submit"
                                        onClick={handleConfirmPick}
                                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-500/25"
                                    >
                                        Confirm Sign
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* CONFIRM SKIP MODAL */}
            <AnimatePresence>
                {showConfirmSkip && (
                    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowConfirmSkip(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />

                        {/* Modal Box */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#0b121f] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10"
                        >
                            <div className="p-6">
                                <h3 className="text-lg font-black uppercase tracking-wider mb-2 text-red-400">Skip Wildcard Entry</h3>
                                <p className="text-xs text-slate-400 mb-6">
                                    Are you sure you want to skip your wildcard entry draft slot? Once skipped, you will not be able to choose any player during this phase.
                                </p>

                                <div className="flex gap-3 justify-end">
                                    <button
                                        id="confirm-skip-cancel"
                                        onClick={() => setShowConfirmSkip(false)}
                                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider transition-all"
                                    >
                                        Back
                                    </button>
                                    <button
                                        id="confirm-skip-submit"
                                        onClick={handleConfirmSkip}
                                        className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-500/25"
                                    >
                                        Skip Draft Slot
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
