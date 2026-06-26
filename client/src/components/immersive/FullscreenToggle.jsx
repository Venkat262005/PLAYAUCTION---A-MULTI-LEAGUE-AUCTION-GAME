import React, { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FullscreenToggle = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Keyboard shortcut 'F'
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'f' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1, backgroundColor: 'rgba(212, 175, 55, 0.2)' }}
      whileTap={{ scale: 0.9 }}
      onClick={toggleFullscreen}
      className="p-1.5 sm:p-2 rounded-full glass-panel border border-yellow-500/30 transition-colors shrink-0"
      title="Toggle Fullscreen (F)"
    >
      <AnimatePresence mode="wait">
        {isFullscreen ? (
          <motion.div
            key="minimize"
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
          >
            <Minimize className="w-5 h-5 text-yellow-500" />
          </motion.div>
        ) : (
          <motion.div
            key="maximize"
            initial={{ opacity: 0, rotate: 90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: -90 }}
          >
            <Maximize className="w-5 h-5 text-yellow-500" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default FullscreenToggle;
