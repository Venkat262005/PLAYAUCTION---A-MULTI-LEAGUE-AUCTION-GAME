import React from 'react';
import { getTeamLogoUrl } from '../utils/teamLogos';

// Medal colours per rank
const RANK_COLORS = ['#FFD700', '#E2E8F0', '#CD7F32', '#60A5FA', '#94A3B8', '#64748B'];
const RANK_LABELS = ['🏆 CHAMPION', '🥈 RUNNER-UP', '🥉 3RD PLACE', '4TH RANKED', '5TH RANKED', '6TH RANKED'];

const ScoreGrade = ({ score }) => {
    if (score >= 88) return { label: 'S TIER · ELITE', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)' };
    if (score >= 78) return { label: 'A TIER · STRONG', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)' };
    if (score >= 68) return { label: 'B TIER · SOLID', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)' };
    if (score >= 50) return { label: 'C TIER · AVERAGE', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' };
    return { label: 'D TIER · RISK', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' };
};

const GlobalResultCard = ({ results, league = 'ipl' }) => {
    if (!results || results.length === 0) return null;

    const leagueDisplayName = league === 'sa20' ? 'SA20' : (league === 'wpl' ? 'WPL' : 'IPL');

    // Sort descending by score (ensure rank accuracy)
    const sorted = [...results].sort((a, b) => (b.evaluation?.overallScore ?? 0) - (a.evaluation?.overallScore ?? 0));
    const champion = sorted[0];
    const championLogo = getTeamLogoUrl(champion.teamName, league, champion.logoUrl || champion.franchiseId?.logoUrl);
    const maxScore = sorted[0]?.evaluation?.overallScore || 100;

    return (
        <div
            id="global-result-card"
            className="relative overflow-hidden font-sans text-white"
            style={{
                width: '1240px',
                minHeight: '820px',
                background: 'radial-gradient(ellipse at 50% 0%, #2e1065 0%, #160733 35%, #0c041f 65%, #05020c 100%)',
                boxSizing: 'border-box'
            }}
        >
            {/* Ambient Background glows */}
            <div style={{ position: 'absolute', top: '-120px', left: '-100px', width: '550px', height: '550px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-100px', left: '40%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Subtle stadium lights & grid overlay */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

            {/* Top gold champion accent bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6, #3b82f6, #f59e0b)' }} />

            <div style={{ position: 'relative', zIndex: 10, padding: '44px 56px 48px' }}>

                {/* ── HEADER ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 14px', borderRadius: '99px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', marginBottom: '10px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.35em', color: '#fcd34d', textTransform: 'uppercase' }}>
                                OFFICIAL AI SEASON REVIEW · {leagueDisplayName} 2026
                            </span>
                        </div>
                        <h1 style={{ fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.025em', lineHeight: 1, margin: '4px 0 0', textShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
                            <span style={{ color: '#f59e0b' }}>FINAL</span>{' '}
                            <span style={{ color: '#ffffff' }}>VERDICT</span>
                        </h1>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.22em', marginTop: '8px' }}>
                            {leagueDisplayName} 2026 OFFICIAL SQUAD VERDICTS & AI RATINGS
                        </div>
                    </div>

                    {/* Champion spotlight badge */}
                    {champion && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '18px',
                            background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(168,85,247,0.15))',
                            border: '1.5px solid rgba(245,158,11,0.45)', borderRadius: '24px', padding: '14px 22px',
                            boxShadow: '0 10px 40px rgba(245,158,11,0.25)'
                        }}>
                            {/* Champion Logo Container with Owner Name Below */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '74px', flexShrink: 0 }}>
                                <div style={{
                                    width: '68px', height: '68px', borderRadius: '50%',
                                    background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '8px', boxShadow: '0 0 30px rgba(245,158,11,0.6), 0 8px 24px rgba(0,0,0,0.7)',
                                    border: '3px solid #f59e0b'
                                }}>
                                    <img
                                        src={championLogo}
                                        alt={champion.teamName}
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                        crossOrigin="anonymous"
                                    />
                                </div>
                                <div style={{
                                    fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
                                    color: '#fcd34d', marginTop: '6px', textAlign: 'center',
                                    width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }}>
                                    👑 {champion.ownerName || 'CHAMPION'}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.25em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '2px' }}>
                                    🏆 AUCTION CHAMPION
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em', color: '#ffffff', lineHeight: 1.2 }}>
                                    {champion.teamName}
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', background: 'rgba(245,158,11,0.25)', border: '1px solid #f59e0b', padding: '3px 10px', borderRadius: '99px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#fef08a' }}>AI SCORE: {champion.evaluation?.overallScore ?? 100}</span>
                                    <span style={{ fontSize: '9px', color: '#fef08a' }}>·</span>
                                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#ffffff' }}>GRADE {champion.evaluation?.auction_grade || 'A+'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── DIVIDER ── */}
                <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.5), rgba(168,85,247,0.5), transparent)', marginBottom: '28px' }} />

                {/* ── TEAM RANKINGS GRID ── */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sorted.length, 3)}, 1fr)`, gap: '18px' }}>
                    {sorted.map((team, idx) => {
                        const score = team.evaluation?.overallScore ?? 0;
                        const grade = ScoreGrade({ score });
                        const logoPath = getTeamLogoUrl(team.teamName, league, team.logoUrl || team.franchiseId?.logoUrl);
                        const rankColor = RANK_COLORS[idx] || '#7C8FA0';
                        const rankLabel = RANK_LABELS[idx] || `#${idx + 1} RANKED`;
                        const isChamp = idx === 0;
                        const barWidth = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
                        const starPlayer = team.evaluation?.starPlayer;
                        const projectedFinish = team.evaluation?.tournament_projection?.projected_finish || (idx < 2 ? 'Finalist' : (idx < 4 ? 'Playoffs' : 'Eliminated'));

                        return (
                            <div
                                key={idx}
                                style={{
                                    background: isChamp
                                        ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(168,85,247,0.08))'
                                        : 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                                    border: isChamp
                                        ? '1.5px solid rgba(245,158,11,0.5)'
                                        : '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '24px',
                                    padding: '22px 20px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: isChamp ? '0 12px 35px rgba(245,158,11,0.15)' : '0 8px 25px rgba(0,0,0,0.4)',
                                }}
                            >
                                {/* Rank badge */}
                                <div style={{
                                    position: 'absolute', top: '14px', right: '16px',
                                    fontSize: '9px', fontWeight: 900, letterSpacing: '0.12em',
                                    textTransform: 'uppercase', color: rankColor,
                                    background: `${rankColor}18`, border: `1px solid ${rankColor}40`,
                                    padding: '3px 10px', borderRadius: '99px'
                                }}>
                                    {rankLabel}
                                </div>

                                {/* Team row: Logo with Owner Name below + Identity + Score */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>

                                    {/* ── Team Logo with Owner Name Below (User Request Enhancement) ── */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '70px', flexShrink: 0 }}>
                                        <div style={{
                                            width: '62px', height: '62px', borderRadius: '50%',
                                            background: '#ffffff', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', padding: '7px',
                                            boxShadow: isChamp ? '0 0 25px rgba(245,158,11,0.5), 0 6px 18px rgba(0,0,0,0.6)' : '0 6px 18px rgba(0,0,0,0.6)',
                                            border: isChamp ? '2.5px solid #f59e0b' : '2px solid rgba(255,255,255,0.25)',
                                        }}>
                                            <img
                                                src={logoPath}
                                                alt={team.teamName}
                                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                        {/* Owner Name placed directly below team logo */}
                                        <div style={{
                                            fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
                                            color: isChamp ? '#fcd34d' : '#93c5fd', marginTop: '6px', textAlign: 'center',
                                            width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>
                                            👑 {team.ownerName || 'OWNER'}
                                        </div>
                                    </div>

                                    {/* Team Details & Rating */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.2, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {team.teamName}
                                        </div>

                                        {/* Golden Rating Pill (Sample Image Style) */}
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px',
                                            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                                            color: '#000000', padding: '3px 10px', borderRadius: '99px',
                                            boxShadow: '0 2px 10px rgba(245,158,11,0.3)'
                                        }}>
                                            <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                                RATING: {score}
                                            </span>
                                            <span style={{ fontSize: '9px', fontWeight: 800, opacity: 0.8 }}>·</span>
                                            <span style={{ fontSize: '9px', fontWeight: 900 }}>
                                                {grade.label.split('·')[0].trim()}
                                            </span>
                                        </div>

                                        {/* Tournament Projection Badge */}
                                        <div style={{ marginTop: '5px' }}>
                                            <span style={{
                                                fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                                                color: idx < 4 ? '#86efac' : '#f87171'
                                            }}>
                                                {idx === 0 ? '🏆 Title Favourite' : (idx === 1 ? '🥈 Finalist Contender' : (idx < 4 ? '🎯 Top 4 Contender' : `📉 ${idx + 1}th (Eliminated)`))}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Big AI Score Number */}
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{
                                            fontSize: '34px', fontWeight: 900, fontFamily: 'monospace', lineHeight: 1,
                                            color: isChamp ? '#f59e0b' : '#ffffff',
                                            textShadow: isChamp ? '0 0 20px rgba(245,158,11,0.5)' : 'none'
                                        }}>
                                            {score}
                                        </div>
                                        <div style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '2px' }}>
                                            / 100 AI
                                        </div>
                                    </div>
                                </div>

                                {/* Score progress bar */}
                                <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', marginBottom: '10px' }}>
                                    <div style={{
                                        height: '100%', width: `${barWidth}%`,
                                        background: isChamp
                                            ? 'linear-gradient(90deg, #f59e0b, #fde047)'
                                            : `linear-gradient(90deg, ${team.teamThemeColor || '#60a5fa'}, ${team.teamThemeColor || '#a855f7'})`,
                                        borderRadius: '99px',
                                        boxShadow: isChamp ? '0 0 10px rgba(245,158,11,0.6)' : 'none'
                                    }} />
                                </div>

                                {/* Star player */}
                                {starPlayer && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '10px', color: '#fcd34d' }}>⭐</span>
                                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            STAR: {starPlayer}
                                        </span>
                                    </div>
                                )}

                                {/* Tactical verdict quote */}
                                {team.evaluation?.tacticalVerdict && (
                                    <div style={{
                                        fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic',
                                        lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                                    }}>
                                        "{team.evaluation.tacticalVerdict}"
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── FOOTER ── */}
                <div style={{ marginTop: '36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '18px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)' }}>
                        Official {leagueDisplayName} Auction Verdict · Verified by Google Gemini AI
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.25em', color: '#f59e0b' }}>
                        PLAYAUCTIONVERDICT.COM
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalResultCard;
