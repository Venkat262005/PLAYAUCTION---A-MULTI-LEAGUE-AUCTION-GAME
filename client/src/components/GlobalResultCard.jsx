import React from 'react';

// Medal colours per rank
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#7C8FA0', '#7C8FA0', '#7C8FA0'];
const RANK_LABELS = ['🏆 CHAMPION', '🥈 RUNNER-UP', '🥉 3RD PLACE', '4TH', '5TH', '6TH'];

const ScoreGrade = ({ score }) => {
    if (score >= 85) return { label: 'S TIER', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
    if (score >= 75) return { label: 'A TIER', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
    if (score >= 65) return { label: 'B TIER', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' };
    if (score >= 50) return { label: 'C TIER', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
    return { label: 'D TIER', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
};

const GlobalResultCard = ({ results, league = 'ipl' }) => {
    if (!results || results.length === 0) return null;

    const leagueDisplayName = league === 'sa20' ? 'SA20' : (league === 'wpl' ? 'WPL' : 'IPL');
    const champion = results[0];
    const championLogo = champion.logoUrl || champion.franchiseId?.logoUrl;

    // Sort descending by score (should already be sorted, but ensure)
    const sorted = [...results].sort((a, b) => (b.evaluation?.overallScore ?? 0) - (a.evaluation?.overallScore ?? 0));
    const maxScore = sorted[0]?.evaluation?.overallScore || 100;

    return (
        <div
            id="global-result-card"
            className="relative overflow-hidden font-sans text-white"
            style={{
                width: '1200px',
                minHeight: '760px',
                background: 'linear-gradient(135deg, #0a0118 0%, #130826 40%, #0b0f23 75%, #050810 100%)',
            }}
        >
            {/* Decorative BG blobs */}
            <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-80px', right: '-80px', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Grid pattern overlay */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '50px 50px', pointerEvents: 'none' }} />

            {/* Top accent line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #f59e0b, #a855f7, #3b82f6, transparent)' }} />

            <div style={{ position: 'relative', zIndex: 10, padding: '48px 64px 56px' }}>

                {/* ── HEADER ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.4em', color: 'rgba(245,158,11,0.6)', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Official AI Season Review · {leagueDisplayName} 2026
                        </div>
                        <h1 style={{ fontSize: '42px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>
                            <span style={{ color: '#f59e0b' }}>FINAL</span>{' '}
                            <span style={{ color: 'white' }}>VERDICT</span>
                        </h1>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.25em', marginTop: '6px' }}>
                            Squad Ratings & Championship Rankings
                        </div>
                    </div>

                    {/* Champion spotlight */}
                    {championLogo && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <div style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.3em', color: '#f59e0b', textTransform: 'uppercase' }}>🏆 Champion</div>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', boxShadow: '0 0 40px rgba(245,158,11,0.4), 0 0 80px rgba(245,158,11,0.15)', border: '3px solid rgba(245,158,11,0.6)' }}>
                                <img src={championLogo} alt={champion.teamName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} crossOrigin="anonymous"
                                    onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(champion.teamName)}`; }} />
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'white', textAlign: 'center', maxWidth: '120px', lineHeight: 1.2 }}>
                                {champion.teamName}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── DIVIDER ── */}
                <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), rgba(168,85,247,0.4), transparent)', marginBottom: '32px' }} />

                {/* ── TEAM RANKINGS GRID ── */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sorted.length, 3)}, 1fr)`, gap: '16px' }}>
                    {sorted.map((team, idx) => {
                        const score = team.evaluation?.overallScore ?? 0;
                        const isDisqualified = score === 0;
                        const grade = ScoreGrade({ score });
                        const logoPath = team.logoUrl || team.franchiseId?.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(team.teamName)}`;
                        const rankColor = RANK_COLORS[idx] || '#7C8FA0';
                        const rankLabel = RANK_LABELS[idx] || `#${idx + 1}`;
                        const isChamp = idx === 0;
                        const barWidth = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
                        const starPlayer = team.evaluation?.starPlayer;

                        return (
                            <div
                                key={idx}
                                style={{
                                    background: isChamp
                                        ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))'
                                        : 'rgba(255,255,255,0.04)',
                                    border: isChamp
                                        ? '1px solid rgba(245,158,11,0.35)'
                                        : '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '20px',
                                    padding: '20px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Rank badge */}
                                <div style={{
                                    position: 'absolute', top: '12px', right: '14px',
                                    fontSize: '8px', fontWeight: 900, letterSpacing: '0.15em',
                                    textTransform: 'uppercase', color: rankColor,
                                    background: `${rankColor}15`, border: `1px solid ${rankColor}30`,
                                    padding: '3px 8px', borderRadius: '20px'
                                }}>
                                    {rankLabel}
                                </div>

                                {/* Team identity row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                                    <div style={{
                                        width: '56px', height: '56px', borderRadius: '50%',
                                        background: 'white', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', padding: '8px', flexShrink: 0,
                                        boxShadow: isChamp ? '0 0 20px rgba(245,158,11,0.3)' : '0 4px 15px rgba(0,0,0,0.4)',
                                        border: isChamp ? '2px solid rgba(245,158,11,0.5)' : '2px solid rgba(255,255,255,0.15)',
                                    }}>
                                        <img src={logoPath} alt={team.teamName}
                                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                            crossOrigin="anonymous"
                                            onError={(e) => { e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(team.teamName)}`; }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', lineHeight: 1.2, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {team.teamName}
                                        </div>
                                        {team.ownerName && (
                                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
                                                {team.ownerName}
                                            </div>
                                        )}
                                        {/* Grade pill */}
                                        <div style={{
                                            display: 'inline-block', marginTop: '5px',
                                            fontSize: '8px', fontWeight: 900, letterSpacing: '0.15em',
                                            textTransform: 'uppercase', color: grade.color,
                                            background: grade.bg, border: `1px solid ${grade.color}40`,
                                            padding: '2px 8px', borderRadius: '20px'
                                        }}>
                                            {isDisqualified ? '❌ DQ' : grade.label}
                                        </div>
                                    </div>

                                    {/* Score */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{
                                            fontSize: '36px', fontWeight: 900, fontFamily: 'monospace', lineHeight: 1,
                                            color: isDisqualified ? '#ef4444' : (isChamp ? '#f59e0b' : 'white'),
                                            textShadow: isChamp ? '0 0 20px rgba(245,158,11,0.4)' : 'none'
                                        }}>
                                            {isDisqualified ? '0' : score}
                                        </div>
                                        <div style={{ fontSize: '7px', fontWeight: 900, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                                            AI Score
                                        </div>
                                    </div>
                                </div>

                                {/* Score bar */}
                                {!isDisqualified && (
                                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden', marginBottom: '12px' }}>
                                        <div style={{
                                            height: '100%', width: `${barWidth}%`,
                                            background: isChamp
                                                ? 'linear-gradient(90deg, #f59e0b, #fcd34d)'
                                                : `linear-gradient(90deg, ${team.teamThemeColor || '#7c8fa0'}, ${team.teamThemeColor || '#7c8fa0'}80)`,
                                            borderRadius: '99px',
                                            boxShadow: isChamp ? '0 0 8px rgba(245,158,11,0.5)' : 'none'
                                        }} />
                                    </div>
                                )}

                                {/* Star player */}
                                {starPlayer && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontSize: '9px' }}>⭐</span>
                                        <span style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {starPlayer}
                                        </span>
                                    </div>
                                )}

                                {/* Tactical verdict snippet */}
                                {team.evaluation?.tacticalVerdict && (
                                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '6px', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                        {team.evaluation.tacticalVerdict}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── FOOTER ── */}
                <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.2)' }}>
                        Generated by {leagueDisplayName} Auction Verdict · Powered by Gemini AI
                    </div>
                    <div style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'rgba(245,158,11,0.4)' }}>
                        PlayAuctionVerdict.com
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalResultCard;
