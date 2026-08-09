'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PlayerColor } from '@/game/engine/types';
import { getCharacter } from '@/game/characters';
import { CharacterArt, TokenExpression } from './CharacterArt';

export type { TokenExpression } from './CharacterArt';

export type TokenState = 'idle' | 'moving' | 'selected' | 'captured' | 'finished';
export interface CharacterTokenProps {
  characterId: string;
  playerColor: PlayerColor;
  state?: TokenState;
  selected?: boolean;
  selectable?: boolean;
  moving?: boolean;
  captured?: boolean;
  finished?: boolean;
  expression?: TokenExpression;
  onClick?: () => void;
  className?: string;
}

/*
 * Reusable character token. The parent controls size/positioning;
 * this component only renders the character + its own soft animations.
 */
export const CharacterToken: React.FC<CharacterTokenProps> = ({
  playerColor,
  state = 'idle',
  selected = false,
  selectable = false,
  moving = false,
  captured = false,
  finished = false,
  expression = 'idle',
  onClick,
  className = '',
}) => {
  const char = getCharacter(playerColor);

  // Derive expression from state if not explicitly provided.
  let expr: TokenExpression = expression;
  if (captured || state === 'captured') expr = 'hurt';
  else if (state === 'finished' || finished || state === 'selected' || selected) expr = 'excited';
  else if (moving || state === 'moving') expr = 'happy';
  else if (selectable) expr = 'excited';

  return (
    <motion.div
      onClick={onClick}
      whileTap={selectable ? { scale: 0.9 } : undefined}
      className={`relative w-full h-full flex items-center justify-center ${className}`}
    >
      {/* Contrast halo behind the character — bright/dark rim so it reads on any
          cell colour (red gotis pop on red track squares too) */}
      <div
        className="absolute -inset-[8%] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${char.primary}38 0%, ${char.primary}12 58%, transparent 72%)`,
          boxShadow: `0 0 0 1.5px rgba(255,255,255,0.22), 0 0 12px rgba(0,0,0,0.3)`,
        }}
      />
      <CharacterArt color={playerColor} expression={expr} />
    </motion.div>
  );
};

export default CharacterToken;