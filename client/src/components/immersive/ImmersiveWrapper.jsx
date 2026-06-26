import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SplashScreen from './SplashScreen';
import AnimatedBackground from './AnimatedBackground';
import FullscreenToggle from './FullscreenToggle';
import { AnimatePresence, motion } from 'framer-motion';
import FeedbackWidget from '../FeedbackWidget';

const ImmersiveWrapper = ({ children }) => {
  const [hasEntered, setHasEntered] = useState(false);
  const location = useLocation();
  
  // Suggested Fullscreen logic
  useEffect(() => {
    if (location.pathname.startsWith('/auction/') && hasEntered) {
      // Small delay to ensure transitions are smooth
      const timer = setTimeout(() => {
        if (!document.fullscreenElement) {
          // Note: browser might block this if not triggered by a direct click, 
          // but handleEnter already attempts it.
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, hasEntered]);

  const handleEnter = () => {
    setHasEntered(true);
    // Attempt fullscreen on first real interaction
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log("Fullscreen request deferred or blocked:", err.message);
      });
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black font-sans text-white">
      <AnimatedBackground />
      
      <AnimatePresence mode="popLayout" initial={false}>
        {!hasEntered ? (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 z-[2000]"
          >
            <SplashScreen onEnter={handleEnter} />
          </motion.div>
        ) : (
          <motion.div
            key="app-content"
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(20px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0, 0, 0.2, 1] }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Fullscreen — hidden on auction/results (controls live in page header) */}
            {!location.pathname.startsWith('/auction/') && !location.pathname.startsWith('/results/') && !location.pathname.startsWith('/quiz/') && !location.pathname.startsWith('/evaluating/') && (
              <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[1000] flex items-center gap-4 pointer-events-none">
                <div className="pointer-events-auto">
                  <FullscreenToggle />
                </div>
              </div>
            )}
            
            <div className="w-full h-full overflow-y-auto scroll-smooth">
              {children}
            </div>
            {!location.pathname.startsWith('/admin/') && !location.pathname.startsWith('/auction/') && <FeedbackWidget />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImmersiveWrapper;
