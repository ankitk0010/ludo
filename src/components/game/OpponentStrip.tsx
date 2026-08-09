'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { Player, PlayerColor } from '@/game/engine/types';
import { gameTheme } from '@/theme/tokens';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';

interface OpponentStripProps {
  players: Player[];
  currentColor: string;
  /** Color of whoever is speaking through their mic right now. */
  speakingColor?: string;
  /** Number of finished tokens per color. */
  finishedCounts?: Record<string, number>;
  /** Tap a chip to view that player's profile. */
  onSelect?: (player: Player) => void;
  className?: string;
}

/*
 * Mobile opponent row — a horizontally scrollable set of equal, FIXED-WIDTH
 * chips that never shrink or collapse over each other. Each chip is tappable
 * to open the player's profile (view profile / add friend / invite).
 */
export const OpponentStrip: React.FC<OpponentStripProps> = ({
  players,
  currentColor,
  speakingColor,
  finishedCounts = {},
  onSelect,
  className = '',
}) => {
  if (players.length === 0) return null;

  return (
    <div className={`overflow-x-auto no-scrollbar ${className}`}>
      <div className="flex items-center gap-1.5 w-max mx-auto py-0.5 px-0.5">
        {players.map((p) => {
          const isTurn = p.color === currentColor;
          const isSpeaking = speakingColor === p.color;
          const style = gameTheme.players[p.color as PlayerColor];
          const shortName = p.name.split(' (')[0];
          const homeCount = finishedCounts[p.color] ?? 0;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect?.(p)}
              className="shrink-0 flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border transition-transform active:scale-95"
              style={{
                background: `linear-gradient(120deg, ${style.primary}1f 0%, rgba(15,23,42,0.9) 55%)`,
                borderColor: isTurn ? style.primary : 'rgba(51,65,85,0.55)',
                boxShadow: isTurn ? `0 0 10px ${style.glow}` : '0 2px 8px rgba(0,0,0,0.35)',
              }}
              aria-label={`View ${shortName}'s profile`}
            >
              <div className="relative flex-shrink-0">
                <CharacterAvatar color={p.color as PlayerColor} image={p.avatarUrl} className="w-8 h-8" />
                {isSpeaking && (
                  <motion.span
                    animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0.35, 0.9] }}
                    transition={{ repeat: Infinity, duration: 0.9 }}
                    className="absolute -inset-1 rounded-full pointer-events-none"
                    style={{ border: `2px solid ${style.primary}` }}
                  />
                )}
              </div>

              <div className="min-w-0 max-w-[78px] text-left">
                <div className="truncate text-[10px] font-extrabold text-white leading-tight">{shortName}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[8px] font-black min-w-0">
                  <span className="uppercase shrink-0" style={{ color: style.primary }}>
                    {p.color}
                  </span>
                  {isTurn && (
                    <span className="shrink-0" style={{ color: style.primary }}>
                      ●
                    </span>
                  )}
                  <span className="shrink-0 text-slate-400">🏠{homeCount}</span>
                  {isSpeaking && <span className="shrink-0 text-emerald-400">🔊</span>}
                </div>
              </div>

              <Eye className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OpponentStrip;