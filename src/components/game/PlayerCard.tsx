'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, VolumeX, Bot } from 'lucide-react';
import { Player } from '@/game/engine/types';
import { gameTheme } from '@/theme/tokens';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';

interface PlayerCardProps {
  player: Player;
  currentColor: string;
  /** Color of whoever is speaking through their mic right now. */
  speakingColor?: string;
  /** Finished gotis for this player. */
  homeCount?: number;
  /** Whether this seat has their mic open. */
  micOn?: boolean;
  /** Whether the local speaker output is muted. */
  speakerMuted?: boolean;
  /** Local player (shows a YOU badge + YOUR TURN label). */
  isLocal?: boolean;
  /** Optional uploaded/preset avatar image for this player. */
  avatarImage?: string;
  /** Ultra-compact variant for the mobile opponent strip. */
  compact?: boolean;
  className?: string;
  /** Tap the card to open the player's profile sheet. */
  onClick?: () => void;
}

/*
 * One player profile card — used on the desktop left/right panels and the
 * mobile top/bottom strips. Shows avatar, name, color, home progress, mic /
 * speaking / mute status, connection state and a glowing current-turn frame.
 */
export const PlayerCard: React.FC<PlayerCardProps> = ({
  player: p,
  currentColor,
  speakingColor,
  homeCount = 0,
  micOn = false,
  speakerMuted = false,
  isLocal = false,
  avatarImage,
  compact = false,
  className = '',
  onClick,
}) => {
  const isTurn = p.color === currentColor;
  const isSpeaking = speakingColor === p.color;
  const style = gameTheme.players[p.color];
  const shortName = p.name.split(' (')[0];
  const avatarSrc = avatarImage ?? p.avatarUrl;

  if (compact) {
    return (
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        className={`relative flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-xl border overflow-hidden ${className} ${
          onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''
        }`}
        style={{
          background: `linear-gradient(135deg, ${style.primary}14 0%, rgba(15,23,42,0.85) 60%)`,
          borderTopColor: isTurn ? style.primary : 'rgba(30,41,59,0.65)',
          borderRightColor: isTurn ? style.primary : 'rgba(30,41,59,0.65)',
          borderBottomColor: isTurn ? style.primary : 'rgba(30,41,59,0.65)',
          borderLeftColor: style.primary,
          borderLeftWidth: 4,
          boxShadow: isTurn ? `0 0 10px ${style.glow}` : 'none',
        }}
      >
        <div className="relative flex-shrink-0">
          <CharacterAvatar color={p.color} image={avatarSrc} className="w-8 h-8" />
          {isSpeaking && (
            <motion.span
              animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0.4, 0.9] }}
              transition={{ repeat: Infinity, duration: 0.9 }}
              className="absolute -inset-1 rounded-full pointer-events-none"
              style={{ border: `2px solid ${style.primary}` }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 leading-none">
            <span className="text-[10px] font-extrabold text-white truncate">{shortName}</span>
            {isLocal && (
              <span className="text-[6px] font-black text-purple-300 bg-purple-500/20 px-1 rounded shrink-0">YOU</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[8px] font-bold min-w-0">
            <span className="uppercase shrink-0" style={{ color: style.primary }}>
              {p.color}
            </span>
            {isTurn && (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                style={{ color: style.primary }}
                className="shrink-0"
              >
                ●
              </motion.span>
            )}
            {isSpeaking && (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-emerald-400 flex items-center gap-0.5 shrink-0"
              >
                <span className="text-[7px]">🔊</span>
              </motion.span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              micOn ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800/70 text-slate-500'
            }`}
          >
            {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`relative w-full flex items-center gap-3 pl-3 pr-2 py-3.5 rounded-xl overflow-hidden transition-all border ${className} ${
        onClick ? 'cursor-pointer active:scale-[0.99]' : ''
      }`}
      style={{
        background: `linear-gradient(135deg, ${style.primary}1c 0%, rgba(15,23,42,0.92) 55%)`,
        borderTopColor: isTurn ? style.primary : 'rgba(30,41,59,0.75)',
        borderRightColor: isTurn ? style.primary : 'rgba(30,41,59,0.75)',
        borderBottomColor: isTurn ? style.primary : 'rgba(30,41,59,0.75)',
        borderLeftColor: style.primary,
        borderLeftWidth: 4,
        boxShadow: isTurn ? `0 0 14px ${style.glow}` : '0 2px 6px rgba(0,0,0,0.3)',
      }}
    >
      <div
        className="absolute -right-4 -top-5 w-14 h-14 rounded-full blur-xl opacity-20 pointer-events-none"
        style={{ background: style.primary }}
      />

      {/* Avatar with speaking pulse ring */}
      <div className="relative flex-shrink-0">
        <CharacterAvatar color={p.color} glow={isTurn} image={avatarSrc} className="w-16 h-16" />
        {isSpeaking && (
          <motion.span
            animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0.35, 0.9] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
            className="absolute -inset-1.5 rounded-full pointer-events-none"
            style={{ border: `2px solid ${style.primary}`, boxShadow: `0 0 10px ${style.glow}` }}
          />
        )}
        {isSpeaking && (
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center"
          >
            <span className="text-[7px] leading-none">🔊</span>
          </motion.div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 leading-tight">
          <span className="text-lg font-extrabold text-white truncate">{shortName}</span>
          {isLocal && (
            <span className="text-[8px] font-black text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded-md shrink-0">YOU</span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold min-w-0">
          <span className="uppercase shrink-0" style={{ color: style.primary }}>
            {p.color}
          </span>
          {p.isBot ? (
            <span className="text-slate-500 flex items-center gap-0.5 shrink-0">
              <Bot className="w-2.5 h-2.5" /> Bot
            </span>
          ) : (
            <span className={`flex items-center gap-0.5 shrink-0 ${p.connected ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1 h-1 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              {p.connected ? 'Online' : 'Offline'}
            </span>
          )}
          {speakerMuted && (
            <span className="text-slate-500 flex items-center gap-0.5 shrink-0">
              <VolumeX className="w-2.5 h-2.5" /> Out muted
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-300 min-w-0">
          <span className="shrink-0">🏠 {homeCount}/4</span>
          {isTurn && (
            <motion.span
              animate={{ opacity: [1, 0.45, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="shrink-0"
              style={{ color: style.primary }}
            >
              ● {isLocal ? 'YOUR TURN' : 'TURN'}
            </motion.span>
          )}
          {isSpeaking && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-emerald-400 flex items-center gap-1 shrink-0"
            >
              <Mic className="w-3 h-3" /> SPEAKING
            </motion.span>
          )}
        </div>
      </div>

      {/* Mic + speaker output status */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <span
          className={`w-9 h-9 rounded-full flex items-center justify-center ${
            micOn ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800/70 text-slate-500'
          }`}
        >
          {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </span>
        {speakerMuted && (
          <span className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
            <VolumeX className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;