'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DiceState, PlayerColor } from '@/game/engine/types';
import { gameTheme } from '@/theme/tokens';
import { soundEngine } from '../sound/soundEngine';

interface DiceComponentProps {
  diceState: DiceState;
  activeColor: PlayerColor;
  isMyTurn: boolean;
  onRoll: () => void;
  turnTimeLeft?: number;
  turnTimeout?: number;
}

/*
 * 3D Dice — CSS preserve-3d cube. Face-to-rotation mapping:
 *   Face 1 → front  (rotateY(0))
 *   Face 6 → back   (rotateY(180deg))
 *   Face 4 → right  (rotateY(90deg))
 *   Face 3 → left   (rotateY(-90deg))
 *   Face 2 → top    (rotateX(90deg))
 *   Face 5 → bottom (rotateX(-90deg))
 */
const SHOW_FACE: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0,   ry: 0   },
  2: { rx: -90, ry: 0   },
  3: { rx: 0,   ry: 90  },
  4: { rx: 0,   ry: -90 },
  5: { rx: 90,  ry: 0   },
  6: { rx: 0,   ry: 180 },
};

const FACE_PIPS: Record<number, { top: string; left: string }[]> = {
  1: [{ top: '50%', left: '50%' }],
  2: [{ top: '27%', left: '27%' }, { top: '73%', left: '73%' }],
  3: [{ top: '24%', left: '24%' }, { top: '50%', left: '50%' }, { top: '76%', left: '76%' }],
  4: [
    { top: '27%', left: '27%' }, { top: '27%', left: '73%' },
    { top: '73%', left: '27%' }, { top: '73%', left: '73%' },
  ],
  5: [
    { top: '24%', left: '24%' }, { top: '24%', left: '76%' },
    { top: '50%', left: '50%' },
    { top: '76%', left: '24%' }, { top: '76%', left: '76%' },
  ],
  6: [
    { top: '24%', left: '27%' }, { top: '24%', left: '73%' },
    { top: '50%', left: '27%' }, { top: '50%', left: '73%' },
    { top: '76%', left: '27%' }, { top: '76%', left: '73%' },
  ],
};

const DICE_SIZE = 58;
const HALF = DICE_SIZE / 2;

const CUBE_FACES = [
  { face: 1, transform: `rotateY(0deg) translateZ(${HALF}px)` },
  { face: 6, transform: `rotateY(180deg) translateZ(${HALF}px)` },
  { face: 4, transform: `rotateY(90deg) translateZ(${HALF}px)` },
  { face: 3, transform: `rotateY(-90deg) translateZ(${HALF}px)` },
  { face: 2, transform: `rotateX(90deg) translateZ(${HALF}px)` },
  { face: 5, transform: `rotateX(-90deg) translateZ(${HALF}px)` },
];

export const DiceComponent: React.FC<DiceComponentProps> = ({
  diceState,
  activeColor,
  isMyTurn,
  onRoll,
  turnTimeLeft,
  turnTimeout = 30,
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultValue, setResultValue] = useState<number | null>(null);
  const [rollSeq, setRollSeq] = useState(0);
  const [rotation, setRotation] = useState({ rx: 0, ry: 0 });
  const [shakeKey, setShakeKey] = useState(0);
  const spinRef = useRef(0);
  const cancelRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevNoLegalRef = useRef(false);
  const colorStyle = gameTheme.players[activeColor];

  const noLegalMove = !!diceState.noLegalMove;
  const isRollable = isMyTurn && !diceState.mustMove && !isRolling && !noLegalMove && !diceState.rolling;
  const diceGlow = isRollable ? colorStyle.primary : colorStyle.primary + '55';

  useEffect(() => {
    if (diceState.noLegalMove && !prevNoLegalRef.current) {
      soundEngine.playInvalid();
      setShakeKey((k) => k + 1);
    }
    prevNoLegalRef.current = !!diceState.noLegalMove;
  }, [diceState.noLegalMove]);

  useEffect(() => {
    if (diceState.value === null) {
      const t = setTimeout(() => {
        setIsRolling(false);
        setShowResult(false);
        setResultValue(null);
      }, 0);
      return () => clearTimeout(t);
    }

    const rolledValue = diceState.value;
    let cancelled = false;

    requestAnimationFrame(() => {
      if (cancelled) return;

      setIsRolling(true);
      setShowResult(false);

      const target = SHOW_FACE[rolledValue] || SHOW_FACE[1];
      const nextSpin = spinRef.current + 1;
      spinRef.current = nextSpin;
      setRollSeq(nextSpin);

      const extraSpin = nextSpin * 1440;
      setRotation({ rx: target.rx + extraSpin, ry: target.ry + extraSpin });
      setResultValue(rolledValue);

      cancelRef.current = setTimeout(() => {
        if (cancelled) return;
        setIsRolling(false);
        setShowResult(true);
        soundEngine.playDiceLand();
        if (rolledValue === 6) {
          setTimeout(() => soundEngine.playSpecialSix(), 160);
        }
      }, 1150);
    });

    return () => {
      cancelled = true;
      if (cancelRef.current) { clearTimeout(cancelRef.current); cancelRef.current = null; }
    };
  }, [diceState.value, diceState.rolling]);

  const handleRollClick = () => {
    if (!isMyTurn || diceState.mustMove || isRolling || noLegalMove || diceState.rolling) return;
    soundEngine.playDiceRoll();
    onRoll();
  };

  const timerRatio = turnTimeLeft !== undefined ? Math.max(0, Math.min(1, turnTimeLeft / turnTimeout)) : 1;
  const R = 17;
  const CIRC = 2 * Math.PI * R;

  let hintText = 'WAITING';
  let hintColor = 'text-slate-500';
  if (isRolling)                        { hintText = 'ROLLING…';       hintColor = 'text-amber-400'; }
  else if (noLegalMove)                 { hintText = 'NO MOVES';        hintColor = 'text-red-400'; }
  else if (diceState.mustMove && isMyTurn) { hintText = 'PICK A GOTI';  hintColor = 'text-emerald-400'; }
  else if (isMyTurn)                    { hintText = 'TAP TO ROLL';     hintColor = 'text-green-300'; }

  // Face bg color varies by result value for visual interest
  const faceBg = noLegalMove
    ? 'linear-gradient(155deg, #fff0f0 0%, #fcdada 100%)'
    : showResult && resultValue === 6
      ? 'linear-gradient(155deg, #fffde7 0%, #fde68a 100%)'
      : 'linear-gradient(155deg, #f8faff 0%, #dde8f5 100%)';

  return (
    <div className="flex items-center gap-3 select-none">
      <div className="flex flex-col items-center gap-2">

        {/* Dice container with timer ring */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: 96, height: 96 }}
        >
          {/* SVG timer ring */}
          <svg
            width="96" height="96"
            viewBox="0 0 38 38"
            className="absolute inset-0 -rotate-90 pointer-events-none"
          >
            <circle cx="19" cy="19" r={R} fill="none" stroke="#1e293b" strokeWidth="1.5" opacity="0.6" />
            <motion.circle
              cx="19" cy="19" r={R} fill="none"
              stroke={timerRatio < 0.25 ? '#f87171' : colorStyle.primary}
              strokeWidth="2.5"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - timerRatio)}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${colorStyle.primary}88)` }}
              animate={{ transition: { duration: 1 } }}
            />
          </svg>

          {/* Pulsing glow halo */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            animate={
              isRolling || isRollable
                ? { boxShadow: [
                    `0 0 14px 4px ${diceGlow}44`,
                    `0 0 28px 10px ${diceGlow}22`,
                    `0 0 14px 4px ${diceGlow}44`,
                  ] }
                : { boxShadow: '0 0 0 0 transparent' }
            }
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
            style={{ width: DICE_SIZE + 20, height: DICE_SIZE + 20 }}
          />

          {/* Ground shadow ellipse */}
          <motion.div
            className="absolute rounded-full blur-md"
            animate={{
              width:   isRolling ? DICE_SIZE * 0.9 : DICE_SIZE * 0.65,
              height:  6,
              opacity: isRolling ? 0.7 : 0.4,
              background: isRolling ? `${colorStyle.primary}80` : 'rgba(0,0,0,0.4)',
            }}
            transition={{ duration: 0.4 }}
            style={{ bottom: '-6px' }}
          />

          {/* Bounce wrapper */}
          <motion.div
            animate={isRolling ? { y: [0, -20, -18, 2, -8, 0] } : { y: 0 }}
            transition={isRolling ? { duration: 1.15, ease: [0.22, 0.61, 0.36, 1] } : {}}
            className="flex items-center justify-center"
          >
            {/* Shake wrapper for invalid rolls */}
            <motion.div
              key={`shake-${shakeKey}`}
              initial={false}
              animate={noLegalMove ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
              className="flex items-center justify-center"
            >
              {/* 3D Rotating Cube */}
              <motion.div
                animate={{ rotateX: rotation.rx, rotateY: rotation.ry }}
                transition={{ duration: 1.15, ease: [0.22, 0.61, 0.36, 1] }}
                onClick={handleRollClick}
                style={{
                  width: DICE_SIZE,
                  height: DICE_SIZE,
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  cursor: isRollable ? 'pointer' : 'default',
                }}
              >
                {CUBE_FACES.map(({ face, transform }) => (
                  <div
                    key={face}
                    style={{
                      position: 'absolute',
                      width: DICE_SIZE,
                      height: DICE_SIZE,
                      transform,
                      background: faceBg,
                      borderRadius: `${DICE_SIZE * 0.2}px`,
                      border: `2px solid ${noLegalMove ? '#fca5a5' : diceGlow}`,
                      boxShadow: `
                        inset 0 2px 4px rgba(255,255,255,0.95),
                        inset 0 -3px 6px rgba(0,0,0,0.12),
                        0 4px 12px rgba(0,0,0,0.3)
                      `,
                      backfaceVisibility: 'hidden',
                    }}
                    className="flex items-center justify-center"
                  >
                    <div className="relative w-full h-full">
                      {FACE_PIPS[face].map((pip, idx) => (
                        <div
                          key={idx}
                          className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
                          style={{
                            top: pip.top,
                            left: pip.left,
                            width:  face === 1 ? 13 : 9,
                            height: face === 1 ? 13 : 9,
                            background: noLegalMove
                              ? `radial-gradient(circle at 35% 35%, #ef4444, #7f1d1d)`
                              : `radial-gradient(circle at 35% 35%, ${colorStyle.dark}, #09111e)`,
                            boxShadow: `inset 0 1px 3px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.15)`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Six! golden flash */}
          <AnimatePresence>
            {showResult && resultValue === 6 && !isRolling && (
              <>
                <motion.div
                  key={`sixflash-${rollSeq}`}
                  initial={{ opacity: 0.8, scale: 0.4 }}
                  animate={{ opacity: 0, scale: 2.2 }}
                  exit={{}}
                  transition={{ duration: 0.75, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(255,200,87,0.65), transparent 70%)',
                    boxShadow: '0 0 40px rgba(255,200,87,0.9)',
                  }}
                />
                {['12%', '88%', '12%', '88%'].map((left, i) =>
                  ['10%', '10%', '90%', '90%'].slice(i, i + 1).map((top) => (
                    <motion.span
                      key={`spark-${i}-${rollSeq}`}
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: [0, 1.8, 0], opacity: [1, 1, 0] }}
                      exit={{}}
                      transition={{ duration: 0.65, delay: i * 0.07, ease: 'easeOut' }}
                      className="absolute text-amber-300 font-bold pointer-events-none"
                      style={{ left, top, fontSize: 14, lineHeight: 1 }}
                    >
                      ✦
                    </motion.span>
                  ))
                )}
              </>
            )}
          </AnimatePresence>

          {/* Result pill */}
          <AnimatePresence mode="wait">
            {showResult && resultValue !== null && !isRolling && (
              <motion.div
                key={`pill-${resultValue}-${rollSeq}`}
                initial={{ scale: 0.2, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.2, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 550, damping: 24 }}
                className="absolute -bottom-3 z-20 px-2.5 py-0.5 rounded-full font-black text-[13px] text-white tracking-wide"
                style={{
                  background: resultValue === 6
                    ? 'linear-gradient(135deg, #FFC857, #F59E0B)'
                    : `linear-gradient(135deg, ${colorStyle.primary}, ${colorStyle.dark})`,
                  boxShadow: resultValue === 6
                    ? '0 4px 16px rgba(255,200,87,0.7), 0 0 0 1px rgba(255,200,87,0.3)'
                    : `0 4px 16px ${colorStyle.glow}, 0 0 0 1px ${colorStyle.primary}44`,
                  color: resultValue === 6 ? '#1a0a00' : '#fff',
                }}
              >
                {resultValue}
                {resultValue === 6 && <span className="ml-0.5 text-[8px] opacity-80">+1</span>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status hint */}
        <motion.div
          key={hintText}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-[9px] font-extrabold uppercase tracking-widest ${hintColor}`}
        >
          {noLegalMove ? 'No Legal Moves' : hintText}
        </motion.div>
      </div>
    </div>
  );
};