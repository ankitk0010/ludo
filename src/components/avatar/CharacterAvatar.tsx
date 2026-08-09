'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PlayerColor } from '@/game/engine/types';
import { getCharacter } from '@/game/characters';
import { CharacterArt } from '@/components/game/CharacterArt';
import { gameTheme } from '@/theme/tokens';

interface CharacterAvatarProps {
  color: PlayerColor;
  size?: number;
  selected?: boolean;
  glow?: boolean;
  ring?: boolean;
  /** Grayscale/dimmed appearance (e.g. color already taken by another player). */
  dimmed?: boolean;
  /** Optional uploaded avatar image — replaces the built-in character art. */
  image?: string;
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
}

/*
 * A rounded character avatar used everywhere the player identity appears:
 * registration picker, game top bar, profile sheet and leaderboard.
 * Renders a <div> (never a <button>) so it can safely live inside any
 * interactive parent; when clickable it exposes proper button semantics
 * via role/tabIndex/keyboard handling.
 */
export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  color,
  selected = false,
  glow = false,
  ring = false,
  dimmed = false,
  image,
  className = '',
  onClick,
  'aria-label': ariaLabel,
}) => {
  const char = getCharacter(color);
  const colorStyle = gameTheme.players[color];
  const interactive = typeof onClick === 'function';

  return (
    <motion.div
      role="button"
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? ariaLabel || `${char.title} avatar` : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      whileTap={interactive ? { scale: 0.9 } : undefined}
      className={`relative rounded-full flex items-center justify-center select-none focus-visible:outline-none ${className} ${
        interactive ? 'cursor-pointer' : 'cursor-default'
      } ${dimmed ? 'grayscale' : ''}`}
      style={{
        background: `radial-gradient(circle at 32% 28%, ${char.secondary}55 0%, ${char.primary}3d 55%, ${char.accent}2e 130%)`,
        border: selected || ring ? `2px solid ${colorStyle.primary}` : '2px solid transparent',
        opacity: dimmed ? 0.55 : undefined,
        boxShadow:
          selected || glow
            ? `0 0 18px ${colorStyle.primary}66, 0 4px 14px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.16)`
            : '0 3px 10px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.12)',
        outline: 'none',
      }}
    >
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: `inset 0 2px 6px rgba(255,255,255,0.14), inset 0 -3px 8px rgba(0,0,0,0.25)` }}
      />
      {image ? (
        <div className="relative w-[92%] h-[92%] rounded-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="w-full h-full object-cover" draggable={false} />
        </div>
      ) : (
        <div className="relative w-[86%] h-[86%]">
          <CharacterArt color={color} />
        </div>
      )}

      {/* Selection ring + checkmark */}
      {selected && (
        <>
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            className="absolute -inset-1 rounded-full pointer-events-none"
            style={{ border: `2px solid ${colorStyle.primary}`, boxShadow: `0 0 14px ${colorStyle.primary}88` }}
          />
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 16, delay: 0.08 }}
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-slate-950 shadow"
          >
            ✓
          </motion.span>
        </>
      )}
    </motion.div>
  );
};

export default CharacterAvatar;