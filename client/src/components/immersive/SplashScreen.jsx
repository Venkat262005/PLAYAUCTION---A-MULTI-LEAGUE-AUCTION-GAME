import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Info, Volume2, VolumeX, Gavel } from 'lucide-react';
import CreditsModal from './CreditsModal';

const SplashScreen = ({ onEnter }) => {
  const [showCredits, setShowCredits] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        onEnter();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onEnter]);

  // Generate stable random particles
  const particles = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2, // 2px to 6px
      x: Math.random() * 100, // percentage
      y: Math.random() * 100, // percentage
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 8,
      drift: Math.random() * 100 - 50,
    }));
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#030509] select-none gpu-accelerated font-sans">
      <style>{`
        @keyframes shine {
          0% { transform: translateX(-150%) skewX(-25deg); }
          100% { transform: translateX(150%) skewX(-25deg); }
        }
        .animate-shine-sweep {
          animation: shine 2.5s infinite ease-in-out;
        }
      `}</style>

      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted={isMuted}
          playsInline
          className="w-full h-full object-cover opacity-30 scale-105 animate-slow-zoom"
        >
          <source src="/Auction-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-[#030509] via-transparent to-[#030509]" />
        <div className="absolute inset-0 bg-radial-vignette opacity-80" />
      </div>

      {/* Gold Dust Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-5">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-gradient-to-b from-yellow-300 to-amber-500"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
              boxShadow: '0 0 10px rgba(234, 179, 8, 0.4)',
            }}
            animate={{
              y: [0, -250, -500],
              x: [0, p.drift / 2, p.drift],
              opacity: [0, 0.6, 0.6, 0],
              scale: [1, 1.3, 0.7],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Content */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center text-center px-4"
      >
        {/* Animated Hammer Logo Concept */}
        <motion.div
          animate={{ 
            rotate: isHovered ? [0, -15, 5, -5, 0] : 0,
            scale: isHovered ? 1.05 : 1
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 p-6 rounded-full border border-yellow-500/20 bg-gradient-to-b from-slate-900/80 to-[#030509]/95 shadow-[0_0_60px_rgba(212,175,55,0.1)] relative cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Rotating outer gear rings */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-1 border border-dashed border-yellow-500/10 rounded-full"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-3 border border-dotted border-yellow-500/5 rounded-full"
          />
          
          <div className="relative z-10 w-24 h-24 flex items-center justify-center bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent rounded-full border border-yellow-500/20 shadow-inner">
            <Gavel className="w-12 h-12 text-yellow-400 drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]" />
          </div>
          
          <motion.div 
            animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-yellow-500/10 blur-2xl pointer-events-none"
          />
        </motion.div>

        <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tighter select-none">
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-200 text-sm md:text-base font-bold uppercase tracking-[0.8em] mb-4">
            PREMIUM CONSOLE
          </span>
          <span className="block bg-clip-text text-transparent bg-gradient-to-b from-white via-yellow-200 to-amber-400 drop-shadow-[0_0_40px_rgba(212,175,55,0.3)] leading-tight italic font-serif">
            PLAY AUCTION
          </span>
        </h1>

        <p className="text-slate-400 max-w-md text-sm md:text-base mb-12 font-medium tracking-wide leading-relaxed">
          The ultimate strategy drafting experience. Build your dream squad in high definition.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-6">
          <motion.button
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(212,175,55,0.35)' }}
            whileTap={{ scale: 0.98 }}
            onClick={onEnter}
            className="group relative px-16 py-5 rounded-full overflow-hidden border border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 via-amber-500/10 to-yellow-500/20 backdrop-blur-md transition-all duration-300"
          >
            {/* Shiny sweep effect */}
            <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shine-sweep" style={{ transform: 'skewX(-25deg)' }} />
            
            {/* Pulsing light behind */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10 flex items-center justify-center gap-3">
              <Play className="w-5 h-5 text-yellow-400 fill-yellow-400/30 group-hover:fill-yellow-400 transition-colors" />
              <span className="text-lg font-black text-white tracking-[0.2em] uppercase font-sans">
                Play Now
              </span>
            </div>
          </motion.button>
          
          <div className="flex items-center gap-6 mt-4">
            <motion.button 
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.08)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMuted(!isMuted)}
              className="p-3.5 rounded-full border border-white/10 bg-slate-950/40 backdrop-blur-md text-yellow-500/80 hover:text-yellow-400 hover:border-yellow-500/30 transition-colors shadow-lg"
              title={isMuted ? "Unmute Soundtrack" : "Mute Soundtrack"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.08)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCredits(true)}
              className="px-6 py-2.5 rounded-full border border-white/10 bg-slate-950/40 backdrop-blur-md text-white/60 hover:text-white hover:border-white/20 transition-all font-black text-[10px] tracking-[0.2em] flex items-center gap-2 shadow-lg"
            >
              <Info className="w-3.5 h-3.5 text-yellow-500/80" />
              CREDITS
            </motion.button>
          </div>
        </div>

        <div className="mt-16 text-white/20 text-[10px] font-black tracking-[0.4em] uppercase">
          Press ENTER or tap to continue
        </div>
      </motion.div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 opacity-15">
        <div className="h-px w-12 bg-white" />
        <span className="text-xs font-bold tracking-[0.25em] uppercase">Play Auction Console</span>
        <div className="h-px w-12 bg-white" />
      </div>

      <CreditsModal isOpen={showCredits} onClose={() => setShowCredits(false)} />
    </div>
  );
};

export default SplashScreen;
