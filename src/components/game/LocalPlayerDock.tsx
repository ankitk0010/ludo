'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { Player } from '@/game/engine/types';
import { gameTheme } from '@/theme/tokens';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { VoiceMicApi } from '@/components/sound/useVoiceMic';

interface LocalPlayerDockProps {
  player: Player;
  currentColor: string;
  /** Color of whoever is speaking through their mic right now. */
  speakingColor?: string;
  /** Finished gotis for this player. */
  homeCount?: number;
  mic: VoiceMicApi;
  speakerMuted: boolean;
  onSpeakerToggle: () => void;
  /** Optional uploaded/preset avatar image for this player. */
  avatarImage?: string;
  onOpenProfile?: () => void;
  className?: string;
}

/*
 * Compact floating "you" dock for the mobile game screen. Rendered ON TOP of
 * the board so the board keeps the full stage size. Shows your avatar, name,
 * turn / speaking / home states and embeds the mic + speaker controls — no
 * separate control row eating up screen space.
 */
export const LocalPlayerDock: React.FC<LocalPlayerDockProps> = ({
  player: p,
  currentColor,
  speakingColor,
  homeCount = 0,
  mic,
  speakerMuted,
  onSpeakerToggle,
  avatarImage,
  onOpenProfile,
  className = '',
}) => {
  const isTurn = p.color === currentColor;
  const isSpeaking = !speakerMuted && speakingColor === p.color;
  const style = gameTheme.players[p.color];
  const shortName = p.name.split(' (')[0];
  const { micOn, micBusy, micError, toggleMic } = mic;

  return (
    <div
      className={`relative flex items-center gap-2 rounded-2xl border pl-1.5 pr-1.5 py-1.5 shadow-2xl ${className}`}
      style={{
        borderColor: isTurn ? style.primary : 'rgba(51,65,85,0.6)',
        boxShadow: isTurn
          ? `0 10px 30px -10px ${style.glow}, 0 0 0 1px ${style.primary}33 inset`
          : '0 8px 24px -10px rgba(0,0,0,0.65)',
        background: `linear-gradient(120deg, ${style.primary}24 0%, rgba(15,23,42,0.92) 48%)`,
      }}
    >
      {/* Pulsing turn accent dot on the left edge */}
      <motion.div
        className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        animate={isTurn ? { opacity: [1, 0.25, 1] } : { opacity: 0.5 }}
        transition={{ repeat: Infinity, duration: 1 }}
        style={{ background: style.primary, boxShadow: `0 0 10px ${style.primary}` }}
      />

      {/* Avatar — tap to open your profile */}
      <button
        type="button"
        onClick={onOpenProfile}
        aria-label="Open your profile"
        className="relative rounded-full shrink-0 transition-transform active:scale-95"
      >
        <CharacterAvatar color={p.color} glow={isTurn} image={avatarImage ?? p.avatarUrl} className="w-10 h-10" />
        {isSpeaking && (
          <motion.span
            animate={{ scale: [1, 1.35, 1], opacity: [0.9, 0.3, 0.9] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
            className="absolute -inset-1 rounded-full pointer-events-none"
            style={{ border: `2px solid ${style.primary}` }}
          />
        )}
      </button>

      {/* Name + live status */}
      <div className="min-w-0 flex-1 text-left" onClick={onOpenProfile}>
        <div className="flex items-center gap-1.5 leading-none">
          <span className="text-[13px] font-black text-white truncate">{shortName}</span>
          <span className="text-[7px] font-black text-purple-300 bg-purple-500/25 px-1.5 py-0.5 rounded-full shrink-0">
            YOU
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] font-black uppercase tracking-wide shrink-0" style={{ color: style.primary }}>
            {p.color}
          </span>
          <span className="text-[9px] font-bold text-slate-400 shrink-0">🏠 {homeCount}/4</span>
          {isTurn ? (
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.1 }}
              className="text-[9px] font-black text-emerald-300 shrink-0 flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> YOUR TURN
            </motion.span>
          ) : isSpeaking ? (
            <span className="text-[9px] font-bold text-emerald-400 shrink-0">speaking…</span>
          ) : null}
        </div>
      </div>

      {/* Voice controls — compact row embedded in the dock */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Live mic equalizer */}
        {micOn && (
          <div className="flex items-end gap-[2px] h-4 mr-0.5">
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                animate={mic.speaking ? { height: ['35%', '100%', '35%'] } : { height: '28%' }}
                transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.09 }}
                className="w-[3px] rounded-full"
                style={{ background: style.primary, height: '28%' }}
              />
            ))}
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleMic}
          disabled={micBusy}
          aria-label={micOn ? 'Turn mic off' : 'Turn mic on'}
          className={`relative w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
            micError
              ? 'bg-red-500/15 text-red-400 border-red-500/50'
              : micBusy
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : micOn
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-800/90 text-slate-300 border-slate-700'
          }`}
        >
          {micBusy ? (
            <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          ) : micOn ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
          {micError && !micBusy && (
            <AlertTriangle className="w-2.5 h-2.5 absolute top-0.5 right-0.5 text-red-400" />
          )}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onSpeakerToggle}
          aria-label={speakerMuted ? 'Turn speaker on' : 'Turn speaker off'}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
            speakerMuted
              ? 'bg-slate-800/90 text-slate-400 border-slate-700'
              : 'bg-sky-500/15 text-sky-400 border-sky-500/40'
          }`}
        >
          {speakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </motion.button>
      </div>
    </div>
  );
};

export default LocalPlayerDock;