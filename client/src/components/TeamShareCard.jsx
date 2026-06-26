import React from 'react';

const TeamShareCard = ({ team, allPlayersMap, league = 'ipl' }) => {
    if (!team) return null;

    const leagueDisplayName = league === 'sa20' ? 'SA20' : (league === 'wpl' ? 'WPL' : 'IPL');

    // ── Star / featured player ────────────────────────────────────────────────
    const featuredPlayerName = team.evaluation?.starPlayer;
    const featuredPlayerEntry = (team.playersAcquired || []).find(entry => {
        const pData = (entry.player && typeof entry.player === 'string') ? allPlayersMap[entry.player] : entry.player;
        const name = entry.name || pData?.player || pData?.name || pData?.playerName;
        return name === featuredPlayerName;
    });
    const displayPlayerEntry = featuredPlayerEntry || (team.playersAcquired || [])[0];
    const displayPlayerData = (displayPlayerEntry?.player && typeof displayPlayerEntry.player === 'string')
        ? allPlayersMap[displayPlayerEntry.player]
        : (displayPlayerEntry?.player || displayPlayerEntry);

    const starName    = displayPlayerEntry?.name || displayPlayerData?.player || displayPlayerData?.name || 'Star Player';
    const starImage   = displayPlayerEntry?.image_path || displayPlayerData?.image_path || displayPlayerData?.imagepath || displayPlayerData?.photoUrl
        || `https://api.dicebear.com/7.x/avataaars/svg?seed=${starName}`;
    const starRole    = displayPlayerEntry?.role || displayPlayerData?.role || '';
    const starBid     = displayPlayerEntry?.boughtFor;

    const themeColor  = team.teamThemeColor || '#1a1a2e';
    const logoUrl     = team.logoUrl || team.franchiseId?.logoUrl;

    // ── Team name display (stacked) ───────────────────────────────────────────
    const nameParts   = (team.teamName || '').split(' ');

    // ── Squad list ────────────────────────────────────────────────────────────
    const players = (team.playersAcquired || []).map(entry => {
        const pData = (entry.player && typeof entry.player === 'string') ? allPlayersMap[entry.player] : (entry.player || entry);
        const pName = (entry.name || pData?.player || pData?.name || 'Unknown Player').toUpperCase();
        const nat   = (entry.nationality || pData?.nationality || '').toLowerCase().trim();
        let isOverseas = entry.isOverseas;
        if (isOverseas === undefined) {
            if (league === 'sa20') isOverseas = nat && !['rsa', 'south africa', 'sa'].includes(nat);
            else isOverseas = nat && !['india', 'indian', 'ind'].includes(nat);
        }
        const isStar = pName === starName.toUpperCase();
        return { name: pName, isOverseas, isStar };
    });

    // Hex → rgba helper
    const hexToRgba = (hex, alpha) => {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    return (
        <div
            id="team-share-card"
            style={{
                width: '1000px',
                minHeight: '1080px',
                position: 'relative',
                overflow: 'hidden',
                fontFamily: 'Inter, system-ui, sans-serif',
                color: 'white',
                background: `linear-gradient(145deg, ${themeColor} 0%, #0a0a14 55%, #05050d 100%)`,
            }}
        >
            {/* ── Background decoration ── */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.5), rgba(255,255,255,0.1))' }} />
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)', backgroundSize: '44px 44px', pointerEvents: 'none' }} />

            {/* Large team color blob at top-right */}
            <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle, ${hexToRgba(themeColor, 0.35)} 0%, transparent 70%)`, pointerEvents: 'none' }} />

            {/* Dot grid pattern (top-left decoration) */}
            <div style={{ position: 'absolute', top: '48px', left: '48px', display: 'grid', gridTemplateColumns: 'repeat(4, 10px)', gap: '6px', opacity: 0.4 }}>
                {[...Array(16)].map((_, i) => (
                    <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />
                ))}
            </div>

            {/* Triangle accents (bottom-left) */}
            <div style={{ position: 'absolute', bottom: '48px', left: '48px', display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.35 }}>
                {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '14px solid white' }} />
                ))}
            </div>

            {/* ── HEADER: Star Player Photo + Team Branding ── */}
            <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'flex-start', gap: '0', padding: '0 0 0 0' }}>

                {/* Star Player Image — left aligned, full height bleed */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    {/* Photo container */}
                    <div style={{
                        width: '320px',
                        height: '380px',
                        overflow: 'hidden',
                        position: 'relative',
                        background: `linear-gradient(180deg, ${hexToRgba(themeColor, 0.3)} 0%, rgba(0,0,0,0.6) 100%)`,
                    }}>
                        <img
                            src={starImage}
                            alt={starName}
                            crossOrigin="anonymous"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
                            onError={(e) => {
                                e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(starName)}`;
                            }}
                        />
                        {/* Gradient fade at bottom of photo */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '160px', background: 'linear-gradient(0deg, #0a0a14 0%, transparent 100%)' }} />
                        {/* Gradient fade on right side */}
                        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '80px', background: 'linear-gradient(90deg, transparent, #0a0a14)' }} />

                        {/* Star badge overlay */}
                        <div style={{
                            position: 'absolute', top: '20px', left: '20px',
                            fontSize: '8px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase',
                            background: `linear-gradient(135deg, ${themeColor}, rgba(0,0,0,0.8))`,
                            border: '1px solid rgba(255,255,255,0.25)',
                            padding: '5px 12px', borderRadius: '20px', color: 'white'
                        }}>
                            ⭐ STAR PLAYER
                        </div>
                    </div>

                    {/* Star player name card */}
                    <div style={{ position: 'absolute', bottom: '24px', left: '0', right: '0', padding: '0 20px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                            {starName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            {starRole && (
                                <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.55)' }}>
                                    {starRole}
                                </div>
                            )}
                            {starBid && (
                                <div style={{
                                    fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
                                    color: '#fbbf24', background: 'rgba(245,158,11,0.15)',
                                    border: '1px solid rgba(245,158,11,0.3)',
                                    padding: '2px 8px', borderRadius: '12px'
                                }}>
                                    {starBid} {league === 'sa20' ? 'R' : 'L'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Team Branding — right side */}
                <div style={{ flex: 1, padding: '48px 56px 0 40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end' }}>
                    {/* Logo */}
                    {logoUrl && (
                        <div style={{ marginBottom: '16px' }}>
                            <img
                                src={logoUrl} alt="team logo"
                                crossOrigin="anonymous"
                                style={{ height: '90px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))' }}
                            />
                        </div>
                    )}

                    {/* Team name stacked */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
                        {nameParts.map((part, i) => (
                            <span key={i} style={{
                                fontSize: i === nameParts.length - 1 ? '72px' : '28px',
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                letterSpacing: i === nameParts.length - 1 ? '-0.03em' : '0.05em',
                                lineHeight: i === nameParts.length - 1 ? 0.9 : 1.2,
                                color: 'white',
                                textShadow: i === nameParts.length - 1 ? `0 0 40px ${hexToRgba(themeColor, 0.6)}` : 'none',
                                display: 'block',
                                marginTop: i === nameParts.length - 1 ? '4px' : 0
                            }}>
                                {part}
                            </span>
                        ))}
                        <span style={{ fontSize: '90px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.04em', lineHeight: 0.85, color: 'rgba(255,255,255,0.12)', display: 'block', marginTop: '2px' }}>
                            SQUAD
                        </span>
                    </div>

                    {/* League badge */}
                    <div style={{ marginTop: '16px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px' }}>
                        {leagueDisplayName} 2026
                    </div>
                </div>
            </div>

            {/* ── DIVIDER ── */}
            <div style={{
                position: 'relative', zIndex: 10,
                margin: '0 56px 24px',
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${hexToRgba(themeColor, 0.6)}, rgba(255,255,255,0.2), transparent)`
            }} />

            {/* ── FULL SQUAD GRID ── */}
            <div style={{ position: 'relative', zIndex: 10, padding: '0 56px' }}>
                <div style={{ fontSize: '8px', fontWeight: 900, letterSpacing: '0.35em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '14px' }}>
                    Complete Acquired Squad · {players.length} Players
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {players.map((p, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: p.isStar
                                    ? `linear-gradient(135deg, ${hexToRgba(themeColor, 0.4)}, ${hexToRgba(themeColor, 0.15)})`
                                    : 'rgba(255,255,255,0.05)',
                                border: p.isStar
                                    ? `1px solid ${hexToRgba(themeColor, 0.5)}`
                                    : '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '30px',
                                padding: '9px 14px',
                                gap: '8px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                {p.isStar && <span style={{ fontSize: '10px', flexShrink: 0 }}>⭐</span>}
                                <span style={{
                                    fontSize: '10px', fontWeight: p.isStar ? 900 : 700,
                                    textTransform: 'uppercase', letterSpacing: '0.04em',
                                    color: p.isStar ? 'white' : 'rgba(255,255,255,0.8)',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }}>
                                    {p.name}
                                </span>
                            </div>
                            {p.isOverseas && (
                                <svg
                                    style={{ width: '12px', height: '12px', color: 'white', opacity: 0.7, fill: 'currentColor', flexShrink: 0, transform: 'rotate(45deg)' }}
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                                </svg>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── FOOTER ── */}
            <div style={{
                position: 'relative', zIndex: 10,
                margin: '28px 56px 0',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingBottom: '36px'
            }}>
                <div style={{ fontSize: '8px', fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
                    #PlayAuctionVerdict
                </div>
                <div style={{ fontSize: '8px', fontWeight: 900, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
                    Generated by {leagueDisplayName} Auction Verdict · Gemini AI
                </div>
            </div>
        </div>
    );
};

export default TeamShareCard;
