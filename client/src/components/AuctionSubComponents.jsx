import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getFlagUrl, fmtCr, fmtParts, LEAGUE_DEFAULTS, resolvePlayerImageUrl, getPlayerImageFallback } from "../utils/playerUtils";

/** Sold / unsold feed row — team logo, owner, player → price, team slogan */
const AuctionFeedLine = memo(({
  playerName,
  playerImage,
  teamLogo,
  teamShort,
  teamColor,
  ownerName,
  amount,
  slogan,
  fmt,
  isUnsold = false,
  timestamp,
}) => {
  const photo = resolvePlayerImageUrl({ image_path: playerImage, imagepath: playerImage, photoUrl: playerImage })
    || playerImage
    || getPlayerImageFallback({ name: playerName });
  const accent = teamColor || '#D4AF37';

  if (isUnsold) {
    return (
      <div className="w-full py-3 border-b border-[#D4AF37]/8 last:border-0">
        <div className="flex items-center gap-2.5">
          <img
            src={photo}
            alt=""
            className="w-9 h-9 rounded-full object-cover object-top shrink-0 opacity-50 grayscale"
            onError={(e) => { e.target.src = getPlayerImageFallback({ name: playerName }); }}
          />
          <span className="flex-1 min-w-0 text-[11px] font-black text-white/80 uppercase tracking-wide truncate">
            {playerName || 'Unknown'}
          </span>
          <span className="text-[9px] font-bold text-[#D4AF37]/35 uppercase tracking-[0.18em] shrink-0">unsold</span>
        </div>
        <p className="text-[9px] text-[#D4AF37]/40 italic mt-1.5 pl-[2.875rem]">no bids received</p>
        {timestamp && <span className="text-[8px] text-[#D4AF37]/20 mt-1 block pl-[2.875rem]">{timestamp}</span>}
      </div>
    );
  }

  return (
    <div className="w-full py-3 border-b border-[#D4AF37]/8 last:border-0">
      <div className="flex gap-3">
        {/* Team logo — not initials */}
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center p-1.5"
          style={{ background: `${accent}18`, boxShadow: `0 0 0 1px ${accent}33` }}
        >
          {teamLogo ? (
            <img src={teamLogo} alt="" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[9px] font-black" style={{ color: accent }}>{teamShort || '?'}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Owner + team badge */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-black text-white truncate">{ownerName || 'Franchise'}</span>
            {teamShort && (
              <span
                className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}
              >
                {teamShort}
              </span>
            )}
          </div>

          {/* Player → price */}
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <img
              src={photo}
              alt=""
              className="w-5 h-5 rounded-full object-cover object-top shrink-0"
              onError={(e) => { e.target.src = getPlayerImageFallback({ name: playerName }); }}
            />
            <span className="text-[11px] font-bold truncate" style={{ color: accent }}>
              {playerName || 'Unknown'}
            </span>
            <span className="text-white/25 text-[10px] shrink-0">→</span>
            {amount != null && (
              <span className="text-[11px] font-mono font-black text-emerald-400 shrink-0">
                {fmt(amount)}
              </span>
            )}
          </div>

          {/* Team slogan */}
          {slogan && (
            <p className="text-[9px] text-white/40 italic leading-snug pr-1">
              {slogan}
            </p>
          )}

          {timestamp && (
            <span className="text-[8px] text-[#D4AF37]/20 font-medium">{timestamp}</span>
          )}
        </div>
      </div>
    </div>
  );
});

const TeamRow = memo(({
  t,
  i,
  currentBidTeamId,
  expandedTeamId,
  setExpandedTeamId,
  allPlayersMap,
  onlineMap,
  isHost,
  isPrimaryHost,
  coHostUserIds,
  mySocketId,
  onKick,
  onToggleCoHost,
  roster = [], // New prop: lazy-loaded players
  voiceParticipants = new Set(),
  league = 'ipl',
  currency,
}) => {
  const isExpanded = expandedTeamId === t.franchiseId;
  const isActive = currentBidTeamId === t.franchiseId;
  const teamOwnerId = t.ownerUserId;
  const activeCurrency = currency || LEAGUE_DEFAULTS[league] || 'inr';
  const sourceCurrency = LEAGUE_DEFAULTS[league] || 'inr';
  const fmt = (lakhs) => fmtCr(lakhs, activeCurrency, sourceCurrency);
  const fmtP = (lakhs) => fmtParts(lakhs, activeCurrency, sourceCurrency);

  // Use lightweight role counts from server or calculate if roster available
  const counts = t.roleCounts || (roster || []).reduce((acc, p) => {
    const playerRecord = allPlayersMap[p.player] || allPlayersMap[p._id] || {};
    const role = (p.role || playerRecord.role || p.playerRole || "").toLowerCase();

    if (role.includes("wk") || role.includes("wicket") || role.includes("keeper")) acc.wk++;
    else if (role.includes("all") || role.includes("ar")) acc.ar++;
    else if (role.includes("bowl") || role.includes("bw")) acc.bowl++;
    else acc.bat++;

    const nationality = p.nationality || playerRecord.nationality || "";
    const isOverseas = p.isOverseas || p.overseas || playerRecord.isOverseas ||
      (nationality && !["india", "ind"].includes(nationality.toLowerCase().trim()));
    if (isOverseas) acc.fr++;

    const pool = String(p.poolID || p.poolName || playerRecord.poolID || playerRecord.poolName || '').toLowerCase();
    if (league === 'sa20') {
      const isUncapped = p.isUncapped || playerRecord.isUncapped || pool.includes('domestic');
      if (isUncapped) acc.uncapped++;
    } else {
      const age = Number(p.age || playerRecord.age || p.Age || playerRecord.Age || 0);
      const isU23 = p.isU23 || playerRecord.isU23 || (age > 0 && age <= 23) ||
                    pool.includes('emerging') || pool.includes('rookie');
      if (isU23) acc.u23++;
    }

    return acc;
  }, { bat: 0, bowl: 0, ar: 0, wk: 0, fr: 0, u23: 0, uncapped: 0 });

  return (
    <motion.div
      onClick={() => setExpandedTeamId(isExpanded ? null : t.franchiseId)}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: i * 0.05 }}
      className={`
        p-4 flex flex-col relative transition-all duration-300 cursor-pointer rounded-2xl
        ${isActive
          ? "bg-[#1a1205]/90 border-[#D4AF37]/25 shadow-[0_10px_30px_rgba(212,175,55,0.08)] scale-[1.01]"
          : "bg-[#120a02]/70 hover:bg-[#1a1205]/80 border-[#D4AF37]/10"}
        border backdrop-blur-md
      `}
    >
      {/* Active Glow Effect */}
      {isActive && (
        <div className="absolute inset-y-0 left-0 w-1 bg-white rounded-l-2xl shadow-[0_0_15px_white]"></div>
      )}

      <div className="flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          {t.teamLogo && (
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center p-1.5 border border-white/10 shadow-lg">
                <img
                  src={t.teamLogo}
                  alt={t.teamName}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
          <div className="flex flex-col">
            <span
              className="font-black text-[11px] lg:text-[12px] tracking-wider uppercase leading-none mb-1 text-slate-100"
            >
              {t.teamName}
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[120px] flex items-center gap-1">
              {t.ownerName}
              {(mySocketId && (t.ownerSocketId === mySocketId || t.ownerUserId === mySocketId)) ? "(You)" : ""}
              {t.isHost ? "(Host)" : coHostUserIds.includes(t.ownerUserId) ? "(Co-Host)" : ""}
              {t.ownerSocketId && voiceParticipants?.has(t.ownerSocketId) && (
                <span className="ml-1 text-emerald-500 animate-pulse" title="In Voice Chat">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-baseline gap-1.5 flex-nowrap">
            <span className="font-mono font-black text-lg lg:text-xl text-white leading-none">
              {fmtP(t.currentPurse).primary}
            </span>
            {fmtP(t.currentPurse).secondary && (
              <span className="text-[10px] lg:text-xs font-bold text-[#FFE58F]/80 leading-none whitespace-nowrap">
                ({fmtP(t.currentPurse).secondary})
              </span>
            )}
          </div>
          <span className="text-[8px] font-black text-slate-500 tracking-tighter uppercase mt-1">
            PURSE REMAINING
          </span>
          {(league === 'wpl' || league === 'sa20') && (t.rtmCards || 0) > 0 && (
            <span className="text-[9px] font-extrabold text-emerald-400 tracking-wider uppercase mt-1">
              RTM: {t.rtmCards - (t.rtmUsedCount || 0)} LEFT
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 z-10">
        <div className="flex flex-wrap items-center gap-1">
          {t.acquiredCount > 0 || t.playersAcquired?.length > 0 ? (
            <>
              {counts.bat > 0 && <span className="bg-[#241607]/80 border border-[#D4AF37]/10 px-2 py-0.5 rounded-lg text-[8px] font-bold text-[#FFE58F]/80">BAT {counts.bat}</span>}
              {counts.bowl > 0 && <span className="bg-[#241607]/80 border border-[#D4AF37]/10 px-2 py-0.5 rounded-lg text-[8px] font-bold text-[#FFE58F]/80">BOW {counts.bowl}</span>}
              {counts.ar > 0 && <span className="bg-[#241607]/80 border border-[#D4AF37]/10 px-2 py-0.5 rounded-lg text-[8px] font-bold text-[#FFE58F]/80">AR {counts.ar}</span>}
              {counts.wk > 0 && <span className="bg-[#241607]/80 border border-[#D4AF37]/10 px-2 py-0.5 rounded-lg text-[8px] font-bold text-[#FFE58F]/80">WK {counts.wk}</span>}
              {counts.fr > 0 && <span className="bg-[#241607]/80 border border-[#D4AF37]/10 px-2 py-0.5 rounded-lg text-[8px] font-bold text-[#FFE58F]/80">OS {counts.fr}</span>}
              {league === 'sa20' && (
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black border transition-all ${
                  (counts.uncapped || 0) >= 2 
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 font-extrabold' 
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse font-extrabold'
                }`}>
                  UNC {counts.uncapped || 0}/2
                </span>
              )}
            </>
          ) : (
            <span className="text-[8px] font-black text-slate-600 tracking-widest uppercase italic">Building Squad...</span>
          )}
        </div>
        <div className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${(t.acquiredCount || t.playersAcquired?.length || 0) >= (league === 'wpl' ? 18 : (league === 'sa20' ? 19 : 25)) ? 'bg-red-500/10 border-red-500/30 text-red-500 animate-pulse' : 'bg-white/5 border-white/10 text-slate-500'}`}>
          {t.acquiredCount || t.playersAcquired?.length || 0}/{league === 'wpl' ? 18 : (league === 'sa20' ? 19 : 25)}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (t.acquiredCount > 0 || (roster && roster.length > 0)) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 border-t border-white/5 pt-3 flex flex-col gap-1.5 z-10 overflow-hidden"
          >
            {(!roster || roster.length === 0) && (!t.playersAcquired || t.playersAcquired.length === 0) ? (
              <div className="text-[10px] text-slate-500 italic text-center py-2 animate-pulse">Building squad...</div>
            ) : (roster && roster.length > 0 ? roster : t.playersAcquired).map((p, idx) => {
              const playerRecord = allPlayersMap[p.player] || allPlayersMap[p._id] || {};
              let displayName = p.name || playerRecord.name || playerRecord.player || p.player || "Unknown";
              const role = (p.role || playerRecord.role || "").toLowerCase();
              
              let roleIcon = <img src="/game_logos/cricket-bat.png" alt="Batter" className="w-3.5 h-3.5 invert opacity-80" />;
              if (role.includes("wk")) {
                roleIcon = <img src="/game_logos/game.png" alt="WK" className="w-3.5 h-3.5 invert opacity-80" />;
              } else if (role.includes("all") || role.includes("ar")) {
                roleIcon = <img src="/game_logos/cricket.png" alt="All-Rounder" className="w-3.5 h-3.5 invert opacity-80" />;
              } else if (role.includes("bowl")) {
                roleIcon = <img src="/game_logos/ball.png" alt="Bowler" className="w-3.5 h-3.5 invert opacity-80" />;
              }

              const nationality = p.nationality || playerRecord.nationality || "";
              const isOverseas = p.isOverseas || p.overseas || playerRecord.isOverseas ||
                (nationality && !["india", "ind"].includes(nationality.toLowerCase().trim()));

              return (
                <div
                  key={idx}
                  className="flex justify-between items-center text-[10px] font-bold bg-[#1a1205]/60 px-2.5 py-1.5 rounded-xl border border-[#D4AF37]/10 hover:bg-[#241607]/70 transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {isOverseas && <img src="/game_logos/airplane.png" alt="Overseas" className="w-3.5 h-3.5 invert opacity-80 shrink-0" />}
                    <span className="truncate text-slate-300">{displayName}</span>
                    <span className="shrink-0 opacity-60">{roleIcon}</span>
                  </div>
                  <span className="text-white font-mono">{fmt(p.boughtFor)}</span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Host Action Overlay */}
      <div className="absolute top-2 right-2 flex items-center gap-2 z-20">
        {isPrimaryHost && t.ownerUserId !== mySocketId && onToggleCoHost && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCoHost(t.ownerUserId);
            }}
            className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border transition-all ${coHostUserIds.includes(t.ownerUserId)
              ? "bg-[#FFE58F] text-[#1a1205] border-[#FFE58F]"
              : "bg-transparent text-[#D4AF37]/60 border-[#D4AF37]/20 hover:bg-[#D4AF37]/10"
              }`}
            title={coHostUserIds.includes(t.ownerUserId) ? "Remove Co-Host" : "Make Co-Host"}
          >
            {coHostUserIds.includes(t.ownerUserId) ? "Co-Host" : "+ Co-Host"}
          </button>
        )}

        {isHost && t.ownerSocketId !== mySocketId && onKick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKick(t.ownerSocketId, t.ownerName);
            }}
            className="w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center transition-all border border-red-500/20 shadow-lg"
            title={`Kick ${t.ownerName}`}
          >
            <X size={12} strokeWidth={3} />
          </button>
        )}
      </div>
    </motion.div>
  );
});

export const TeamList = memo(
  ({
    teams,
    currentBidTeamId,
    expandedTeamId,
    setExpandedTeamId,
    allPlayersMap,
    onlineMap = {},
    isHost = false,
    isPrimaryHost = false,
    coHostUserIds = [],
    mySocketId = null,
    onKick = null,
    onToggleCoHost = null,
    teamRosters = {},
    voiceParticipants = new Set(),
    league = 'ipl',
    currency,
    fmt,
  }) => (
    <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3 custom-scrollbar">
      {teams.map((t, i) => (
        <TeamRow
          key={t.franchiseId || i}
          roster={teamRosters[t.id || t.franchiseId]}
          t={t}
          i={i}
          currentBidTeamId={currentBidTeamId}
          expandedTeamId={expandedTeamId}
          setExpandedTeamId={setExpandedTeamId}
          allPlayersMap={allPlayersMap}
          onlineMap={onlineMap}
          isHost={isHost}
          isPrimaryHost={isPrimaryHost}
          coHostUserIds={coHostUserIds}
          mySocketId={mySocketId}
          onKick={onKick}
          onToggleCoHost={onToggleCoHost}
          voiceParticipants={voiceParticipants}
          league={league}
          currency={currency}
        />
      ))}
    </div>
  ),
);

export const BidHistory = memo(({ bidHistory, currency, league = 'ipl' }) => {
  const activeCurrency = currency || LEAGUE_DEFAULTS[league] || 'inr';
  const sourceCurrency = LEAGUE_DEFAULTS[league] || 'inr';
  const fmt = (lakhs) => fmtCr(lakhs, activeCurrency, sourceCurrency);
  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col-reverse gap-2.5 custom-scrollbar pt-4">
    <div className="flex flex-col-reverse gap-2.5">
      {bidHistory.map((bid) => (
        <motion.div
          key={bid.id}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="relative group lg:px-0 px-2"
        >
          <div className="bg-[#D4AF37]/5 backdrop-blur-md border border-[#D4AF37]/30 p-2.5 rounded-xl shadow-[0_5px_15px_rgba(0,0,0,0.3)] relative overflow-hidden flex items-center gap-3 hover:bg-[#D4AF37]/10 transition-colors">
            {/* Left accent line */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 shadow-[0_0_10px_rgba(212,175,55,0.5)]"
              style={{ backgroundColor: bid.teamColor }}
            ></div>

            <div className="w-9 h-9 shrink-0 bg-white/5 rounded-full flex items-center justify-center p-1.5 border border-[#D4AF37]/20 shadow-inner">
              {bid.teamLogo ? (
                <img src={bid.teamLogo} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[10px] font-black text-white">{(bid.teamName || '?').charAt(0)}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider truncate" style={{ color: bid.teamColor }}>
                  {bid.teamName}
                </span>
                <span className="text-[8px] text-[#FFE58F]/60 font-bold">{bid.time}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-bold text-[#FFE58F]/40 uppercase tracking-widest truncate">{bid.ownerName}</span>
                <span className="text-[13px] font-black font-mono text-white tracking-tight drop-shadow-sm">{fmt(bid.amount)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
    {bidHistory.length === 0 && (
      <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-30">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37] animate-pulse">
          Awaiting Initial Bid
        </div>
      </div>
    )}
    </div>
  );
});

const ChatMessage = memo(({ msg, isMe, currency, league = 'ipl' }) => {
  const isSold = msg.type === 'sold';
  const activeCurrency = currency || LEAGUE_DEFAULTS[league] || 'inr';
  const sourceCurrency = LEAGUE_DEFAULTS[league] || 'inr';
  const fmt = (lakhs) => fmtCr(lakhs, activeCurrency, sourceCurrency);

  // --- Standard Chat Message ---
  if (!msg.type || msg.type === 'chat') {
    return (
      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} gap-1.5 w-full`}>
        <div className="flex items-center gap-2 mb-0.5 px-2">
          {!isMe && msg.senderLogo && (
            <img src={msg.senderLogo} alt="" className="w-3.5 h-3.5 object-contain" />
          )}
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: msg.senderColor || "#D4AF37" }}>
            {msg.senderName}
            {msg.senderTeam && <span className="text-[#D4AF37]/40 ml-1.5 font-bold">[{msg.senderTeam}]</span>}
          </span>
          <span className="text-[8px] text-[#D4AF37]/30 font-bold">{msg.timestamp}</span>
        </div>
        <div
          className={`max-w-[88%] px-4 py-2.5 rounded-2xl text-[11px] font-medium leading-relaxed shadow-lg
                ${isMe
              ? "bg-gradient-to-br from-[#FFE58F] to-[#D4AF37] text-[#1a1205] rounded-tr-sm shadow-[0_5px_15px_rgba(212,175,55,0.2)]"
              : "bg-[#1a1205]/60 text-[#FFE58F]/90 rounded-tl-sm border border-[#D4AF37]/20 backdrop-blur-md"}
          `}
        >
          {msg.message}
        </div>
      </div>
    );
  }

  // --- BIDDING WAR Alert ---
  if (msg.type === 'bidding_war') {
    const poolLabel =
      (msg.poolID || '').toLowerCase().startsWith('marquee') ? 'Marquee' :
      (msg.poolID || '').toLowerCase().includes('pool1') ? 'Pool 1' : 'Emerging';
    return (
      <div className="w-full py-1.5 px-2">
        <div className="relative bg-[#1a0d00]/80 backdrop-blur-md border border-orange-500/50 rounded-xl p-3 shadow-[0_0_30px_rgba(249,115,22,0.3)] overflow-hidden">
          {/* Animated amber glow pulse */}
          <div className="absolute inset-0 rounded-xl bg-orange-500/5 animate-pulse pointer-events-none" />

          {/* Top banner */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-400 animate-pulse">
              🔥 BIDDING WAR ALERT 🔥
            </span>
            <div className="ml-auto text-[8px] font-bold text-orange-400/40">{msg.timestamp}</div>
          </div>

          {/* Player row */}
          <div className="flex items-center gap-3 relative z-10">
            {/* Player image */}
            {msg.playerImage ? (
              <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-orange-500/60 shadow-[0_0_14px_rgba(249,115,22,0.5)] shrink-0 bg-black/40">
                <img src={msg.playerImage} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-full border-2 border-orange-500/50 bg-orange-900/30 flex items-center justify-center shrink-0">
                <span className="text-orange-400 text-xl">🔥</span>
              </div>
            )}

            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[14px] font-black text-white uppercase tracking-tight truncate leading-none">
                {msg.playerName || 'Player'}
              </span>
              <span className="text-[9px] font-bold text-orange-400/70 uppercase tracking-widest mt-0.5">
                {poolLabel} · Teams are fighting!
              </span>
            </div>


          </div>

          {/* Caption */}
          <div className="mt-2.5 border-t border-orange-500/15 pt-2">
            <span className="text-[8px] font-bold text-orange-400/50 italic">
              ⚔️ The battle is heating up — who will win this one?
            </span>
          </div>

          {/* Left accent */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500/70 shadow-[0_0_8px_rgba(249,115,22,0.7)]" />
        </div>
      </div>
    );
  }

  // --- SHOCKING UNSOLD (Marquee / Pool 1) — premium minimal line ---
  if (msg.type === 'shocking_unsold') {
    return (
      <AuctionFeedLine
        playerName={msg.playerName}
        playerImage={msg.playerImage}
        fmt={fmt}
        isUnsold
        timestamp={msg.timestamp}
      />
    );
  }

  // --- SOLD — premium minimal line ---
  if (isSold) {
    return (
      <AuctionFeedLine
        playerName={msg.playerName}
        playerImage={msg.playerImage}
        teamLogo={msg.senderLogo}
        teamShort={msg.teamShort}
        teamColor={msg.senderColor}
        ownerName={msg.ownerName}
        amount={msg.amount}
        slogan={msg.slogan || msg.congrats}
        fmt={fmt}
        timestamp={msg.timestamp}
      />
    );
  }


  // --- Bid event — minimal inline line ---
  const isBid = msg.type === 'bid';
  const isUnsold = msg.type === 'unsold';

  if (isUnsold) {
    return (
      <AuctionFeedLine
        playerName={msg.playerName || msg.message}
        playerImage={msg.playerImage}
        fmt={fmt}
        isUnsold
        timestamp={msg.timestamp}
      />
    );
  }

  return (
    <div className="w-full py-2 px-1">
      <div className="flex items-center gap-2.5">
        {msg.senderLogo && (
          <img src={msg.senderLogo} alt="" className="w-5 h-5 object-contain shrink-0 opacity-70" />
        )}
        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5">
          {msg.senderTeam && (
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: msg.senderColor }}>
              {msg.senderTeam.split(' ')[0]}
            </span>
          )}
          <span className="text-[10px] text-[#D4AF37]/40 uppercase tracking-widest">bid</span>
          <span className="text-[11px] font-black text-[#D4AF37]">{fmt(msg.amount)}</span>
          <span className="text-[10px] text-[#D4AF37]/40 uppercase">for</span>
          <span className="text-[11px] font-bold text-white/75">{msg.playerName || msg.message}</span>
        </div>
      </div>
    </div>
  );
});

export const ChatSection = memo(({
  chatMessages,
  recentSold = [],
  unsoldHistory = [],
  auctionFeed = [],
  myTeam,
  chatEndRef,
  chatInput,
  setChatInput,
  handleSendMessage,
  isSpectator,
  onClose,
  league = 'ipl',
  currency,
  fmt: fmtProp,
}) => {
  const fmt = fmtProp || ((lakhs) => fmtCr(lakhs, currency || LEAGUE_DEFAULTS[league] || 'inr', LEAGUE_DEFAULTS[league] || 'inr'));
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent w-full relative">
      <div className="px-6 py-4 flex items-center justify-between border-b border-[#D4AF37]/30 bg-[#1a1205] backdrop-blur-md sticky top-0 z-20">
        <div>
          <h2 className="text-[9px] font-black text-[#FFE58F] uppercase tracking-[0.25em]">
            War Room Chat
          </h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2 rounded-full hover:bg-white/10 text-[#D4AF37]">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0 custom-scrollbar">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#D4AF37]/40 text-[10px] font-black uppercase tracking-[.2em] px-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full border border-[#D4AF37]/30 flex items-center justify-center opacity-60 bg-[#D4AF37]/5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <span className="text-[#FFE58F]/40">Secured Communication Line</span>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMe =
              msg.senderName === (myTeam?.ownerName || "Host") &&
              msg.senderTeam === (myTeam?.teamName || "System");
            return <ChatMessage key={msg.id} msg={msg} isMe={isMe} currency={currency} league={league} />;
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-[#D4AF37]/30 bg-[#1a1205] backdrop-blur-xl">
        {isSpectator ? (
          <div className="py-2.5 px-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl text-center">
            <span className="text-[9px] font-black text-[#D4AF37]/40 uppercase tracking-widest">
              Communication link reserved for owners
            </span>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Strategic communication..."
              className="flex-1 bg-[#0a0702]/40 border border-[#D4AF37]/30 rounded-full px-5 py-2.5 text-[11px] text-[#FFE58F] placeholder-[#D4AF37]/40 focus:outline-none focus:border-[#D4AF37]/60 transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFE58F] via-[#D4AF37] to-[#996515] hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-30 flex items-center justify-center transition-all shadow-[0_5px_15px_rgba(212,175,55,0.3)] shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1205" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
});
