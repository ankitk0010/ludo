'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import { PlayerColor } from '@/game/engine/types';
import { CHARACTER_LIST } from '@/game/characters';
import { CharacterAvatar } from './CharacterAvatar';
import { gameTheme } from '@/theme/tokens';
import { soundEngine } from '@/components/sound/soundEngine';

interface AvatarSelectorProps {
  selected: PlayerColor;
  onSelect: (color: PlayerColor) => void;
  className?: string;
  /** Colors already claimed by other human players — shown as TAKEN and disabled. */
  disabledColors?: PlayerColor[];
}

const ORDER: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

/*
 * Character picker used during registration and in the profile sheet.
 * Tapping an avatar: previous one deselects smoothly, the new one scales
 * 1 -> 1.08 -> 1 with a glow + tiny sparkles and a checkmark. ~400ms total.
 * Colors claimed by other players can be locked with `disabledColors`.
 */
export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  selected,
  onSelect,
  className = '',
  disabledColors = [],
}) => {
  const handleSelect = (color: PlayerColor) => {
    if (color === selected) return;
    if (disabledColors.includes(color)) return;
    soundEngine.playClick();
    onSelect(color);
  };

  return (
    <div className={`grid grid-cols-4 gap-2.5 sm:gap-4 justify-items-center ${className}`} role="radiogroup" aria-label="Choose your character">
      {ORDER.map((color) => {
        const char = CHARACTER_LIST.find((c) => c.color === color);
        const isSelected = color === selected;
        const isTaken = disabledColors.includes(color) && !isSelected;
        const colorStyle = gameTheme.players[color];

        return (
          <motion.div
            key={color}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${char?.title || color} character`}
            aria-disabled={isTaken}
            animate={isSelected ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            className={`relative flex flex-col items-center gap-1.5 ${isTaken ? 'opacity-50' : ''}`}
          >
            {/* soft platform glow behind selection */}
            <div
              className="absolute inset-0 -m-2 rounded-2xl pointer-events-none transition-opacity"
              style={{
                background: `radial-gradient(circle, ${colorStyle.primary}40 0%, transparent 72%)`,
                opacity: isSelected ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            />

            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm pointer-events-none"
                  aria-hidden
                >
                  ✨
                </motion.div>
              )}
              {isTaken && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 pointer-events-none z-10"
                  aria-hidden
                >
                  <Lock className="w-2 h-2" />
                  <span className="text-[7px] font-black uppercase">Taken</span>
                </motion.div>
              )}
            </AnimatePresence>

            <CharacterAvatar
              color={color}
              selected={isSelected}
              glow={isSelected}
              dimmed={isTaken}
              onClick={() => handleSelect(color)}
              className="w-14 h-14 sm:w-16 sm:h-16"
            />

            {/* little sparkle bursts on selection */}
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none"
                  aria-hidden
                >
                  {[0, 60, 120, 180, 240, 300].map((a, i) => {
                    const rad = (a * Math.PI) / 180;
                    return (
                      <motion.span
                        key={i}
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: [0, 1, 0], opacity: [1, 1, 0] }}
                        transition={{ duration: 0.42, delay: 0.05 + i * 0.03, ease: 'easeOut' }}
                        className="absolute text-amber-200"
                        style={{
                          left: '50%',
                          top: '50%',
                          marginLeft: `${Math.round(Math.cos(rad) * 34)}px`,
                          marginTop: `${Math.round(Math.sin(rad) * 34)}px`,
                          fontSize: 8,
                          transform: 'translate(-50%,-50%)',
                        }}
                      >
                        ✦
                      </motion.span>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-[9px] font-black uppercase tracking-widest mt-4" style={{ color: isSelected ? colorStyle.primary : '#64748b' }}>
              {char?.title.split(' ').pop() || color}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default AvatarSelector;