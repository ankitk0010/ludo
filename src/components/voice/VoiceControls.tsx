'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, AlertTriangle } from 'lucide-react';
import type { VoiceMicApi } from '@/components/sound/useVoiceMic';

interface VoiceControlsProps {
  mic: VoiceMicApi;
  speakerMuted: boolean;
  onSpeakerToggle: () => void;
  className?: string;
}

/*
 * Compact voice state cluster:
 *   MIC_CONNECTING  → spinner
 *   MIC_ON / muted  → emerald / slate (speaking dot pulses emerald)
 *   SPEAKER_ON/OFF  → sky / muted
 *   ERROR           → amber warning ring
 * Layout stays beside the local player's profile or in the action bar, so it
 * never overlaps the board, dice or power cards.
 */
export const VoiceControls: React.FC<VoiceControlsProps> = ({
  mic,
  speakerMuted,
  onSpeakerToggle,
  className = '',
}) => {
  const { micOn, micBusy, micError, speaking, toggleMic } = mic;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggleMic}
        disabled={micBusy}
        aria-label={micOn ? 'Turn mic off' : 'Turn mic on'}
        title={micError || (micOn ? 'Mic on' : 'Mic muted')}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${
          micError
            ? 'bg-red-500/15 text-red-400 border-red-500/50'
            : micBusy
              ? 'bg-slate-800 text-slate-400 border-slate-700'
              : micOn
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
        }`}
      >
        {micBusy ? (
          <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        ) : micOn ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4" />
        )}
        {micOn && !micError && (
          <motion.span
            animate={{ scale: speaking ? [1, 1.5, 1] : 1, opacity: speaking ? [1, 0.35, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 0.9 }}
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
              speaking ? 'bg-emerald-400' : 'bg-white/50'
            }`}
          />
        )}
        {micError && !micBusy && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-slate-950 flex items-center justify-center">
            <AlertTriangle className="w-2 h-2 text-white" />
          </span>
        )}
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={onSpeakerToggle}
        aria-label={speakerMuted ? 'Turn speaker on' : 'Turn speaker off'}
        title={speakerMuted ? 'Speaker off' : 'Speaker on'}
        className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${
          speakerMuted
            ? 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700'
            : 'bg-sky-500/15 text-sky-400 border-sky-500/50'
        }`}
      >
        {speakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </motion.button>

      {micOn && (
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggleMic}
          aria-label="Leave voice chat"
          title="Leave voice"
          className="w-10 h-10 rounded-full bg-red-500/15 text-red-400 border border-red-500/50 flex items-center justify-center hover:bg-red-500/25"
        >
          <PhoneOff className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );
};

export default VoiceControls;