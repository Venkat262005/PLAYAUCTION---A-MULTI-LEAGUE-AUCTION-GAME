import React, { useRef } from "react";
import { Radio } from "lucide-react";

/**
 * Polished broadcast-style news headline marquee for the lobby.
 * League-specific data disclaimers regarding player statistics.
 */
const LEAGUE_MESSAGES = {
  ipl: {
    badge: "IPL NEWS DESK",
    headline:
      "PLAYER STATS NOTICE: Player statistics shown reflect tournament-specific historical IPL records and are currently being updated to the latest data. Please note that all metrics represent IPL-specific performances rather than overall T20 career statistics.",
    accent: "#F59E0B",
    gradient: "from-amber-400 to-yellow-500",
    badgeText: "text-slate-950",
    borderColor: "border-amber-500/30",
    glowColor: "rgba(245, 158, 11, 0.15)",
    textColor: "text-amber-300",
  },
  wpl: {
    badge: "WPL NEWS DESK",
    headline:
      "PLAYER STATS NOTICE: Player statistics shown reflect tournament-specific historical WPL records and are currently being updated to the latest data. Please note that all metrics represent WPL-specific performances rather than overall T20 career statistics.",
    accent: "#EC4899",
    gradient: "from-pink-500 to-rose-600",
    badgeText: "text-white",
    borderColor: "border-pink-500/30",
    glowColor: "rgba(236, 72, 153, 0.15)",
    textColor: "text-pink-300",
  },
  sa20: {
    badge: "SA20 NEWS DESK",
    headline:
      "PLAYER STATS NOTICE: Player statistics displayed for SA20 are compiled from overall T20 career records. Recent tournament data is actively being synchronized.",
    accent: "#06B6D4",
    gradient: "from-cyan-400 to-sky-500",
    badgeText: "text-slate-950",
    borderColor: "border-cyan-500/30",
    glowColor: "rgba(6, 182, 212, 0.15)",
    textColor: "text-cyan-300",
  },
};

export default function LeagueNewsMarquee({ league = "ipl", className = "" }) {
  const marqueeRef = useRef(null);
  const normalizedLeague = (league || "ipl").toLowerCase();
  const config = LEAGUE_MESSAGES[normalizedLeague] || LEAGUE_MESSAGES.ipl;

  const handleMouseEnter = () => {
    if (marqueeRef.current && typeof marqueeRef.current.stop === "function") {
      marqueeRef.current.stop();
    }
  };

  const handleMouseLeave = () => {
    if (marqueeRef.current && typeof marqueeRef.current.start === "function") {
      marqueeRef.current.start();
    }
  };

  // Repeating stream content with clean broadcast dividers
  const streamText = (
    <span className="inline-flex items-center gap-10 text-[11px] sm:text-xs tracking-wide">
      <span className="inline-flex items-center gap-2">
        <span className={`font-black ${config.textColor} uppercase tracking-wider`}>[NOTICE]</span>
        <span className="text-slate-200 font-medium">{config.headline}</span>
      </span>
      <span className="text-slate-600 select-none">✦</span>
      <span className="inline-flex items-center gap-2">
        <span className={`font-black ${config.textColor} uppercase tracking-wider`}>[NOTICE]</span>
        <span className="text-slate-200 font-medium">{config.headline}</span>
      </span>
      <span className="text-slate-600 select-none">✦</span>
    </span>
  );

  return (
    <div
      className={`w-full relative overflow-hidden rounded-xl bg-slate-950/80 backdrop-blur-md border ${config.borderColor} shadow-lg transition-all ${className}`}
      style={{
        boxShadow: `0 4px 20px -2px ${config.glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
      title="Hover to pause headline"
    >
      <div className="flex items-center h-10 sm:h-11 overflow-hidden">
        {/* Left Live Badge / News Desk */}
        <div
          className={`shrink-0 z-20 flex items-center gap-2 px-3 sm:px-3.5 h-full bg-gradient-to-r ${config.gradient} ${config.badgeText} font-black text-[10px] sm:text-[11px] uppercase tracking-wider shadow-md select-none`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
          </span>
          <Radio className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          <span className="hidden xs:inline whitespace-nowrap">{config.badge}</span>
          <span className="xs:hidden whitespace-nowrap">LIVE</span>
        </div>

        {/* Marquee Ticker Area */}
        <div
          className="relative flex-1 overflow-hidden h-full flex items-center px-3"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Subtle Left Fade Gradient */}
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-950/90 to-transparent pointer-events-none z-10" />

          {/* Native HTML marquee tag with hover stop/start */}
          <marquee
            ref={marqueeRef}
            behavior="scroll"
            direction="left"
            scrollamount="6"
            className="w-full flex items-center select-none cursor-pointer"
          >
            {streamText}
          </marquee>

          {/* Subtle Right Fade Gradient */}
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-950/90 to-transparent pointer-events-none z-10" />
        </div>
      </div>
    </div>
  );
}
