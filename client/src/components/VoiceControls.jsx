import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Phone } from 'lucide-react';
import { useVoice } from '../context/VoiceContext';

/**
 * Free Fire–style voice: speaker = hear others, mic = others hear you.
 * Speaker ON + Mic OFF → listen only
 * Mic ON → transmit to room
 * Both OFF → connected but silent both ways
 */
const VoiceControls = ({ roomCode, compact = false }) => {
  const {
    isJoined,
    isMuted,
    isSpeakerOn,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleSpeaker,
  } = useVoice();

  const btn = compact ? 'p-1.5' : 'p-2';
  const icon = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  if (!isJoined) {
    return (
      <button
        onClick={() => joinVoice(roomCode)}
        className={`${btn} bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-full hover:bg-yellow-500/20 transition-all flex items-center justify-center`}
        title="Join Voice Chat"
      >
        <Phone className={icon} />
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${compact ? 'p-0.5' : 'p-1'} bg-[#1a1205]/80 border border-[#D4AF37]/20 rounded-full`}>
      {/* Speaker — hear opponents */}
      <button
        onClick={toggleSpeaker}
        className={`${btn} rounded-full border transition-all flex items-center justify-center ${
          isSpeakerOn
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
            : 'bg-white/5 border-white/10 text-[#D4AF37]/40'
        }`}
        title={isSpeakerOn ? 'Mute opponents (speaker off)' : 'Hear opponents (speaker on)'}
      >
        {isSpeakerOn ? <Volume2 className={icon} /> : <VolumeX className={icon} />}
      </button>

      {/* Mic — transmit to others */}
      <button
        onClick={toggleMute}
        className={`${btn} rounded-full border transition-all flex items-center justify-center ${
          !isMuted
            ? 'bg-sky-500/20 border-sky-400/50 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
            : 'bg-white/5 border-white/10 text-[#D4AF37]/40'
        }`}
        title={isMuted ? 'Unmute mic (others will hear you)' : 'Mute mic (others cannot hear you)'}
      >
        {!isMuted ? <Mic className={icon} /> : <MicOff className={icon} />}
      </button>

      <button
        onClick={() => leaveVoice(roomCode)}
        className={`${btn} rounded-full bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all flex items-center justify-center`}
        title="Leave voice chat"
      >
        <Phone className={`${icon} rotate-[135deg]`} />
      </button>
    </div>
  );
};

export default VoiceControls;
