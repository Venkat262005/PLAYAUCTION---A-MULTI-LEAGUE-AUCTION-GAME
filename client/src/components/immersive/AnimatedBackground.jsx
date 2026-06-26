import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const AnimatedBackground = () => {
  const particles = useMemo(() => {
    return [...Array(5)].map((_, i) => ({
      id: i,
      width: Math.random() * 400 + 200 + 'px',
      height: Math.random() * 400 + 200 + 'px',
      left: Math.random() * 100 + '%',
      top: Math.random() * 100 + '%',
      duration: 15 + Math.random() * 10,
      startX: Math.random() * 100 + '%',
      endX: Math.random() * 100 + '%',
      startY: Math.random() * 100 + '%',
      endY: Math.random() * 100 + '%',
    }));
  }, []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-black pointer-events-none gpu-accelerated">
      {/* Cinematic Spotlight */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.15) 0%, transparent 70%)'
        }}
      />

      {/* Moving Mesh Grid */}
      <div className="absolute inset-0 opacity-10 bg-mesh-grid animate-mesh-slide will-change-transform" />

      {/* Sweeping Light Beams */}
      <motion.div 
        animate={{ 
          opacity: [0.1, 0.3, 0.1],
          rotate: [35, 40, 35],
          skewX: [12, 12, 12]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute -top-[50%] -left-[20%] w-[150%] h-[200%] bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent pointer-events-none origin-center will-change-transform"
      />
      
      <motion.div 
        animate={{ 
          opacity: [0.05, 0.2, 0.05],
          rotate: [-45, -40, -45],
          skewX: [-12, -12, -12]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute -top-[50%] -right-[20%] w-[150%] h-[200%] bg-gradient-to-l from-transparent via-yellow-500/10 to-transparent pointer-events-none origin-center will-change-transform"
      />

      {/* Floating Particles/Glows */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-yellow-500/10 blur-[100px] will-change-transform"
            animate={{
              x: [p.startX, p.endX],
              y: [p.startY, p.endY],
              scale: [1, 1.2, 1],
              opacity: [0.05, 0.15, 0.05]
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              width: p.width,
              height: p.height,
              left: p.left,
              top: p.top,
            }}
          />
        ))}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-radial-vignette" />
    </div>
  );
};

export default AnimatedBackground;
