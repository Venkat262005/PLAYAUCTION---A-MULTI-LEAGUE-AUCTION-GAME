import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { playCustomSlam } from '../utils/soundEngine';
import { fmtCr, LEAGUE_DEFAULTS } from '../utils/playerUtils';

/**
 * Sold / unsold stamp — designed to occupy the exact timer column slot.
 * `slot="timer"` constrains width/height to match the countdown circle.
 */
const GavelSlam = ({
    type,
    teamName,
    teamColor,
    teamLogo,
    playerName,
    winningBid,
    playerImage,
    currency = 'inr',
    league = 'ipl',
}) => {
    const isSold = type === 'SOLD';
    const accent = isSold ? (teamColor || '#D4AF37') : '#8B7355';
    const displayName = playerName ? playerName.toUpperCase() : 'PLAYER';
    const priceLabel = isSold ? fmtCr(winningBid?.amount || 0, currency, LEAGUE_DEFAULTS[league] || 'inr') : null;
    const teamShort = teamName ? teamName.split(' ').pop()?.toUpperCase() : '';

    useEffect(() => {
        playCustomSlam(type, teamName);

        if (isSold) {
            const timer = setTimeout(() => {
                confetti({
                    particleCount: 30,
                    spread: 55,
                    origin: { y: 0.5, x: 0.72 },
                    colors: [accent, '#D4AF37', '#FFE58F'],
                    startVelocity: 22,
                    gravity: 1,
                    ticks: 100,
                    scalar: 0.7,
                });
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [type, teamColor, teamName, isSold, accent]);

    const ringClass = 'w-16 h-16 sm:w-28 sm:h-28 md:w-32 md:h-32';

    return (
        <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.75, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="flex flex-col items-center justify-start pointer-events-none w-16 sm:w-28 md:w-32"
        >
            {/* Circle — same footprint as the timer ring */}
            <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05, duration: 0.4 }}
                className={`relative ${ringClass} rounded-full flex items-center justify-center shrink-0`}
                style={{
                    background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.1), transparent 55%), linear-gradient(145deg, ${accent}28, #120a02 70%)`,
                    boxShadow: `0 0 0 1px ${accent}55, 0 0 24px ${accent}28, inset 0 0 20px rgba(0,0,0,0.45)`,
                }}
            >
                <div
                    className="w-[78%] h-[78%] rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                        background: isSold
                            ? `linear-gradient(160deg, ${accent}35, #1a1205 65%)`
                            : 'linear-gradient(160deg, #2a1f14, #120a02)',
                    }}
                >
                    {isSold && teamLogo ? (
                        <img src={teamLogo} alt="" className="w-[58%] h-[58%] object-contain drop-shadow-md" />
                    ) : playerImage ? (
                        <img
                            src={playerImage}
                            alt=""
                            className="w-full h-full object-cover object-top opacity-45 grayscale"
                        />
                    ) : (
                        <span className="text-[8px] font-black text-[#D4AF37]/50 uppercase">
                            {isSold ? teamShort.charAt(0) || '?' : '—'}
                        </span>
                    )}
                </div>
            </motion.div>

            {/* Labels — stacked below circle, within timer column width */}
            <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.35 }}
                className="mt-1 sm:mt-1.5 flex flex-col items-center text-center w-full px-0.5"
            >
                <span
                    className="text-[7px] sm:text-[9px] font-black tracking-[0.2em] uppercase leading-none"
                    style={{ color: isSold ? '#D4AF37' : '#8B7355' }}
                >
                    {isSold ? 'Sold' : 'Unsold'}
                </span>
                <span className="text-[6px] sm:text-[8px] font-bold text-white/75 uppercase tracking-wide w-full truncate leading-tight mt-0.5">
                    {displayName}
                </span>
                {isSold && priceLabel && (
                    <span className="text-[8px] sm:text-[11px] font-mono font-black text-[#FFE58F] leading-none mt-0.5">
                        {priceLabel}
                    </span>
                )}
                {!isSold && (
                    <span className="text-[6px] sm:text-[7px] text-[#D4AF37]/35 uppercase tracking-wider italic mt-0.5">
                        no bids
                    </span>
                )}
            </motion.div>
        </motion.div>
    );
};

export default GavelSlam;
