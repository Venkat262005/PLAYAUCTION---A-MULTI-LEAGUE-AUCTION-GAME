import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, ShieldCheck, Palette, Layout, Database } from 'lucide-react';

const CreditsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl glass-card rounded-3xl overflow-hidden border border-yellow-500/30"
        >
          {/* Header */}
          <div className="p-6 border-b border-yellow-500/20 flex justify-between items-center bg-gradient-to-r from-yellow-500/10 to-transparent">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-black text-gold-gradient tracking-wider">DATA & MEDIA CREDITS</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 max-h-[70vh] overflow-y-auto space-y-8">
            {/* Player Data */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-yellow-500/80 font-bold uppercase tracking-widest text-sm">
                <Database className="w-4 h-4" />
                <span>Data Sources</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2">Player Images</h4>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• IPL Official Website</li>
                    <li>• ESPN Cricinfo</li>
                    <li>• Cricbuzz</li>
                  </ul>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2">Statistics</h4>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• ESPN Cricinfo Stats</li>
                    <li>• IPLT20.com</li>
                    <li>• ICC Cricket</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Design & Graphics */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-yellow-500/80 font-bold uppercase tracking-widest text-sm">
                <Palette className="w-4 h-4" />
                <span>Design & Graphics</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2">Icons</h4>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Font Awesome</li>
                    <li>• Lucide React</li>
                  </ul>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2">Inspiration</h4>
                  <ul className="text-gray-400 text-sm space-y-1">
                    <li>• FIFA Ultimate Team</li>
                    <li>• IPL Mega Auction Broadcast</li>
                    <li>• Esports drafting interfaces</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Footer Message */}
            <div className="text-center pt-4 opacity-50 text-xs italic">
              This application is for educational and entertainment purposes only. All marks and images belong to their respective owners.
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreditsModal;
