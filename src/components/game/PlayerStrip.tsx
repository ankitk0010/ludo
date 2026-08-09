'use client';

import React from 'react';
import { Player, PlayerColor } from '@/game/engine/types';
import { PlayerCard } from './PlayerCard';

interface PlayerStripProps {
  players: Player[];
  currentColor: string;
  /** Color of whoever is speaking through their mic right now. */
  speakingColor?: string;
  /** Local player's seat color (gets the YOU badge + live mic view). */
  localColor?: PlayerColor;
  /** Whether the local mic is open. */
  micOn?: boolean;
  /** Whether the local speaker output is muted. */
  speakerMuted?: boolean;
  /** Spreading: 'center' piles the chips together, 'between' splits them. */
  justify?: 'center' | 'between';
  /** Number of finished tokens per color. */
  finishedCounts?: Record<string, number>;
  /** Ultra-compact cards (mobile opponent strip). */
  compact?: boolean;
  className?: string;
}

/*
 * A row of player cards — mobile opponent strip at the top and the local
 * player row at the bottom, plus the desktop side panels.
 */
export const PlayerStrip: React.FC<PlayerStripProps> = ({
  players,
  currentColor,
  speakingColor,
  localColor,
  micOn = false,
  speakerMuted = false,
  justify = 'center',
  finishedCounts = {},
  compact = false,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center gap-1.5 ${justify === 'between' ? 'justify-between' : 'justify-center'} ${className}`}
    >
      {players.map((p) => (
        <PlayerCard
          key={p.id}
          player={p}
          currentColor={currentColor}
          speakingColor={speakingColor}
          homeCount={finishedCounts[p.color] ?? 0}
          micOn={p.color === localColor && micOn}
          speakerMuted={p.color === localColor && speakerMuted}
          isLocal={p.color === localColor}
          compact={compact}
          className="flex-1 min-w-0"
        />
      ))}
    </div>
  );
};

export default PlayerStrip;