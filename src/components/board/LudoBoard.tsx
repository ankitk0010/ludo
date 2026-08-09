'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GameState, MoveOption, PlayerColor } from '@/game/engine/types';
import { TRACK_GRID_COORDS, HOME_PATH_GRID_COORDS, getStepGridCell, isSafeCell } from '@/game/engine/board';
import { START_POSITIONS } from '@/game/engine/constants';
import { TokenComponent, GotiShape } from './TokenComponent';
import { Crown, Star } from 'lucide-react';
import { gameTheme } from '@/theme/tokens';
import { BOARD_THEME_ACCENT, BoardThemeId } from '@/game/settings';

interface LudoBoardProps {
  gameState: GameState;
  legalMoves: MoveOption[];
  onSelectToken: (tokenId: string) => void;
  gotiShape?: GotiShape;
  theme?: BoardThemeId;
}

// Vivid start-cell gradients — distinct per color, pure CSS only
const COLOR_START_BG: Record<string, string> = {
  red:    'linear-gradient(135deg, #FF6B6B 0%, #be123c 100%)',
  green:  'linear-gradient(135deg, #38D39F 0%, #059669 100%)',
  yellow: 'linear-gradient(135deg, #FFC857 0%, #d97706 100%)',
  blue:   'linear-gradient(135deg, #60a5fa 0%, #4338ca 100%)',
};

// Colored home-path lane backgrounds
const HOME_PATH_BG: Record<PlayerColor, string> = {
  red:    'linear-gradient(135deg, #FF6B6B18 0%, #FF6B6B38 100%)',
  green:  'linear-gradient(135deg, #38D39F18 0%, #38D39F38 100%)',
  yellow: 'linear-gradient(135deg, #FFC85718 0%, #FFC85738 100%)',
  blue:   'linear-gradient(135deg, #3B82F618 0%, #3B82F638 100%)',
};

const HOME_ARROWS: Record<PlayerColor, number> = {
  red: 0, green: 90, yellow: 180, blue: 270,
};

// Per-color palette for home bases — rich, bright room colors (no images, no emoji)
const BASE_PALETTE: Record<PlayerColor, { bg: string; ring: string; shine: string; glow: string }> = {
  red:    { bg: '#7d2436', ring: '#FF8A8A', shine: '#ffb3b3', glow: '#FF6B6B' },
  green:  { bg: '#126049', ring: '#4fe0ad', shine: '#9ef0d2', glow: '#38D39F' },
  yellow: { bg: '#8a5714', ring: '#FFD36E', shine: '#ffe9a8', glow: '#FFC857' },
  blue:   { bg: '#1f5092', ring: '#7FB6FF', shine: '#b7d6ff', glow: '#3B82F6' },
};

const SLOT_CENTERS = [
  { left: 25, top: 25 },
  { left: 75, top: 25 },
  { left: 25, top: 75 },
  { left: 75, top: 75 },
];

// Premium home base component
function HomeBase({ color, position }: { color: PlayerColor; position: string }) {
  const pal = BASE_PALETTE[color];

  return (
    <div
      className={`${position} relative overflow-hidden`}
      style={{
        background: `linear-gradient(160deg, ${pal.bg} 0%, ${pal.bg}dd 62%, rgba(10,15,30,0.9) 100%)`,
        border: `1px solid ${pal.ring}45`,
      }}
    >
      {/* Top light + vignette overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(130% 130% at 50% 0%, ${pal.shine}1f 0%, transparent 55%),
            radial-gradient(ellipse at 15% 15%, ${pal.ring}30 0%, transparent 55%),
            radial-gradient(ellipse at 85% 85%, ${pal.ring}1c 0%, transparent 50%)
          `,
        }}
      />

      {/* Diagonal griddle texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-45deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 10px),' +
            ' repeating-linear-gradient(45deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 10px)',
        }}
      />

      {/* Inset glow + soft top highlight */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 30px rgba(0,0,0,0.22), inset 0 0 0 1px ${pal.ring}20, inset 0 1.5px 0 rgba(255,255,255,0.16)`,
        }}
      />

      {/* 4 embossed slot rings */}
      {SLOT_CENTERS.map((c, idx) => (
        <div
          key={idx}
          className="absolute"
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: '44%',
            aspectRatio: '1 / 1',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{
              background: `radial-gradient(circle at 33% 30%, ${pal.shine}66 0%, ${pal.ring}44 50%, rgba(0,0,0,0.6) 100%)`,
              border: `2px solid ${pal.ring}88`,
              boxShadow: `
                0 5px 16px rgba(0,0,0,0.65),
                0 0 14px ${pal.glow}28,
                inset 0 2px 0 ${pal.shine}77,
                inset 0 -2px 4px rgba(0,0,0,0.4)
              `,
            }}
          >
            {/* Jewel inner dot */}
            <div
              className="w-[42%] aspect-square rounded-full"
              style={{
                background: `radial-gradient(circle at 38% 30%, #ffffff 0%, ${pal.shine} 50%, ${pal.ring} 100%)`,
                boxShadow: `0 0 10px ${pal.glow}bb, inset 0 1px 3px rgba(255,255,255,0.8)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export const LudoBoard: React.FC<LudoBoardProps> = ({
  gameState,
  legalMoves,
  onSelectToken,
  gotiShape = 'classic',
  theme = 'ocean',
}) => {
  const legalTokenIds = legalMoves.map((m) => m.tokenId);
  const allTokens = Object.values(gameState.tokens).flat();
  const accent = BOARD_THEME_ACCENT[theme];

  return (
    <div className="relative w-full h-full aspect-square select-none">
      {/* Ground shadow */}
      <div className="board-glow" />

      {/* Ambient radial bloom around the board */}
      <motion.div
        className="absolute -inset-4 rounded-[2.4rem] pointer-events-none"
        animate={{ opacity: [0.5, 0.85, 0.5] }}
        transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${accent}30 0%, transparent 68%)`,
          filter: 'blur(20px)',
        }}
      />

      {/* Premium board frame — thin accent rim + deep shadow */}
      <div
        className="relative w-full h-full board-elevated rounded-[1.75rem] p-[5px]"
        style={{
          background: `linear-gradient(150deg, ${accent}60 0%, #0b1020 40%, ${accent}38 100%)`,
          boxShadow: `
            0 0 0 1px ${accent}88,
            0 36px 72px -18px rgba(0,0,0,0.85),
            inset 0 1.5px 0 rgba(255,255,255,0.2)
          `,
        }}
      >
        {/* Inner board surface */}
        <div
          className="relative w-full h-full board-frame rounded-[1.4rem] overflow-hidden"
          style={{ background: '#141c38' }}
        >
          {/* Faint dot grid grain */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
              backgroundSize: '22px 22px',
              opacity: 0.4,
            }}
          />

          {/* 15×15 grid */}
          <div className="relative w-full h-full grid grid-cols-15 grid-rows-15">

            {/* HOME BASES */}
            <HomeBase color="red"    position="col-span-6 row-span-6" />
            <HomeBase color="green"  position="col-start-10 col-span-6 row-span-6" />
            <HomeBase color="yellow" position="col-start-10 row-start-10 col-span-6 row-span-6" />
            <HomeBase color="blue"   position="col-span-6 row-start-10 row-span-6" />

            {/* TRACK CELLS */}
            {TRACK_GRID_COORDS.map((cell, idx) => {
              const isRedStart    = idx === START_POSITIONS.red;
              const isGreenStart  = idx === START_POSITIONS.green;
              const isYellowStart = idx === START_POSITIONS.yellow;
              const isBlueStart   = idx === START_POSITIONS.blue;
              const isStar = isSafeCell(idx);

              let startColor: string | null = null;
              if (isRedStart)    startColor = 'red';
              if (isGreenStart)  startColor = 'green';
              if (isYellowStart) startColor = 'yellow';
              if (isBlueStart)   startColor = 'blue';

              return (
                <div
                  key={`track-${idx}`}
                  style={{
                    gridRowStart: cell.row + 1,
                    gridColumnStart: cell.col + 1,
                    background: startColor ? COLOR_START_BG[startColor] : undefined,
                  }}
className={`relative border border-white/[0.07] flex items-center justify-center inset-glow ${
  !startColor ? 'bg-[#16233f]' : ''
}`}
                >
                  {isStar && !startColor && (
                    <motion.div
                      animate={{ rotate: [0, 18, -18, 0], scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                    >
                      <Star className="w-[10px] h-[10px] text-amber-300 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,1)]" />
                    </motion.div>
                  )}
                  {startColor && (
                    <div
                      className="w-[38%] aspect-square rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.92)',
                        boxShadow: `0 0 10px rgba(255,255,255,0.75)`,
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* HOME PATH LANES */}
            {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((color) =>
              HOME_PATH_GRID_COORDS[color].map((cell, idx) => {
                const p = gameTheme.players[color];
                const isLast = idx === HOME_PATH_GRID_COORDS[color].length - 1;
                const rotation = HOME_ARROWS[color];
                return (
                  <div
                    key={`hp-${color}-${idx}`}
                    style={{
                      gridRowStart: cell.row + 1,
                      gridColumnStart: cell.col + 1,
                      background: isLast
                        ? `linear-gradient(135deg, ${p.primary}77 0%, ${p.primary}aa 100%)`
                        : HOME_PATH_BG[color],
                    }}
                    className="border border-white/[0.04] flex items-center justify-center"
                  >
                    <motion.span
                      animate={{ opacity: [0.45, 1, 0.45] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.6,
                        ease: 'easeInOut',
                        delay: idx * 0.14,
                      }}
                      style={{
                        fontSize: '7px',
                        lineHeight: 1,
                        fontWeight: 900,
                        color: p.light,
                        transform: `rotate(${rotation}deg)`,
                        display: 'inline-block',
                        textShadow: `0 0 8px ${p.primary}`,
                      }}
                    >
                      ▶
                    </motion.span>
                  </div>
                );
              })
            )}

            {/* CENTER GOAL — pulsing jewel with 4 color triangles */}
            <div
              className="col-start-7 row-start-7 col-span-3 row-span-3 relative overflow-hidden flex items-center justify-center"
              style={{ background: '#0d1c38' }}
            >
              {/* Four animated color triangles */}
              {[
                { clip: 'polygon(0 0, 0 100%, 50% 50%)',       color: gameTheme.players.red.primary,    delay: 0 },
                { clip: 'polygon(0 0, 100% 0, 50% 50%)',       color: gameTheme.players.green.primary,  delay: 0.35 },
                { clip: 'polygon(100% 0, 100% 100%, 50% 50%)', color: gameTheme.players.yellow.primary, delay: 0.7 },
                { clip: 'polygon(0 100%, 100% 100%, 50% 50%)', color: gameTheme.players.blue.primary,   delay: 1.05 },
              ].map((t, i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut', delay: t.delay }}
                  style={{ clipPath: t.clip, background: t.color }}
                />
              ))}

              {/* White shimmer pulse */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ opacity: [0, 0.3, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.5), transparent 60%)',
                }}
              />

              {/* Crown circle */}
              <div className="relative z-10">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 16, ease: 'linear' }}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(circle, #10203a 0%, #060f1c 100%)',
                    border: '2.5px solid #FFC857',
                    boxShadow: '0 0 20px rgba(255,200,87,0.55), inset 0 0 14px rgba(255,200,87,0.25)',
                  }}
                >
                  <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 fill-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,1)]" />
                </motion.div>
              </div>
            </div>

            {/* TOKENS */}
            {allTokens.map((token) => {
              const tokenCell = getStepGridCell(token.color, token.index, token.stepCount, token.status);
              const sameCellTokens = allTokens.filter((t) => {
                if (t.id === token.id) return true;
                const c = getStepGridCell(t.color, t.index, t.stepCount, t.status);
                return c.row === tokenCell.row && c.col === tokenCell.col;
              });
              const stackIdx = sameCellTokens.findIndex((t) => t.id === token.id);

              return (
                <TokenComponent
                  key={token.id}
                  token={token}
                  isLegalMove={legalTokenIds.includes(token.id)}
                  onSelect={onSelectToken}
                  stackOffsetIndex={stackIdx}
                  totalInCell={sameCellTokens.length}
                  shape={gotiShape}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
