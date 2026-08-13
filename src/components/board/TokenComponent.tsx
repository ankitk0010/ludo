'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Token } from '@/game/engine/types';
import { getStepGridCell, GridCell } from '@/game/engine/board';
import { TOTAL_STEPS_TO_FINISH } from '@/game/engine/constants';
import { gameTheme } from '@/theme/tokens';
import { getCharacter } from '@/game/characters';
import { CharacterToken } from '@/components/game/CharacterToken';
import { Sparkles, ImpactRing, Confetti } from '@/components/effects';
import { soundEngine } from '../sound/soundEngine';

export type GotiShape = 'classic' | 'star' | 'diamond' | 'gem';

interface TokenComponentProps {
  token: Token;
  isLegalMove: boolean;
  onSelect: (tokenId: string) => void;
  stackOffsetIndex?: number;
  totalInCell?: number;
  shape?: GotiShape;
}

const STACK_OFFSETS: Record<number, { dx: number; dy: number }[]> = {
  1: [{ dx: 0, dy: 0 }],
  2: [{ dx: -0.2, dy: -0.1 }, { dx: 0.2, dy: 0.1 }],
  3: [{ dx: -0.25, dy: -0.15 }, { dx: 0.25, dy: -0.15 }, { dx: 0, dy: 0.25 }],
  4: [{ dx: -0.2, dy: -0.2 }, { dx: 0.2, dy: -0.2 }, { dx: -0.2, dy: 0.2 }, { dx: 0.2, dy: 0.2 }],
};

type TokenPhase = 'idle' | 'forward' | 'hit' | 'returning' | 'landing' | 'finished';

const TokenComponentBase: React.FC<TokenComponentProps> = ({
  token,
  isLegalMove,
  onSelect,
  stackOffsetIndex = 0,
  totalInCell = 1,
}) => {
  const colorStyle = gameTheme.players[token.color];
  const cellWidthPct = 100 / 15;

  const [currentCell, setCurrentCell] = useState<GridCell>(() =>
    getStepGridCell(token.color, token.index, token.stepCount, token.status)
  );
  const [phase, setPhase] = useState<TokenPhase>('idle');
  const [hitOrigin, setHitOrigin] = useState<GridCell | null>(null);

  // Refs are updated FIRST so the effect never re-enters the same animation run.
  const stepRef = useRef(token.stepCount);
  const statusRef = useRef(token.status);
  const runIdRef = useRef(0);

  useEffect(() => {
    const prevStep = stepRef.current;
    const prevStatus = statusRef.current;
    const nextStep = token.stepCount;

    const runId = ++runIdRef.current;
    const cancel: (() => void)[] = [];
    const cancelled = () => runId !== runIdRef.current;

    // Mark handled fields immediately to avoid re-triggering on intra-animation renders.
    stepRef.current = nextStep;
    statusRef.current = token.status;

    const homeGridCell = () => getStepGridCell(token.color, token.index, 0, 'home');

    // ---- REACHED HOME CENTER (normal finish) ----
    if (prevStatus === 'active' && token.status === 'finished') {
      const finalCell = getStepGridCell(token.color, token.index, TOTAL_STEPS_TO_FINISH, 'finished');
      setCurrentCell(finalCell);
      setPhase('finished');
      soundEngine.playReachHome();

      const t = setTimeout(() => {
        if (cancelled()) return;
        setPhase('idle');
      }, 900);
      cancel.push(() => clearTimeout(t));
      return () => cancel.forEach((fn) => fn());
    }

    // ---- CAPTURE (CUT): active token sent back home ----
    if (prevStatus === 'active' && token.status === 'home' && prevStep > 0) {
      const origin = getStepGridCell(token.color, token.index, prevStep, 'active');
      setHitOrigin(origin);
      setCurrentCell(origin);
      setPhase('hit');
      soundEngine.playCapture();

      const reverseSteps: GridCell[] = [];
      for (let s = prevStep - 1; s >= 1; s--) {
        reverseSteps.push(getStepGridCell(token.color, token.index, s, 'active'));
      }

      let stepIdx = 0;
      let landed = false;

      const hopTimer = setTimeout(() => {
        if (cancelled()) return;
        setPhase('returning');

        const interval = setInterval(() => {
          if (cancelled()) return clearInterval(interval);
          if (stepIdx < reverseSteps.length) {
            setCurrentCell(reverseSteps[stepIdx]);
            soundEngine.playHopBack();
            stepIdx++;
          } else {
            clearInterval(interval);
            if (landed) return;
            landed = true;
            setCurrentCell(homeGridCell());
            setPhase('landing');
            soundEngine.playCaptureReturn();

            const landTimer = setTimeout(() => {
              if (cancelled()) return;
              setPhase('idle');
              setHitOrigin(null);
            }, 600);
            cancel.push(() => clearTimeout(landTimer));
          }
        }, 110);
        cancel.push(() => clearInterval(interval));
      }, 700);
      cancel.push(() => clearTimeout(hopTimer));

      return () => cancel.forEach((fn) => fn());
    }

    // ---- FORWARD hop during a normal move ----
    if (prevStep !== nextStep && nextStep > prevStep && prevStep > 0 && token.status === 'active') {
      const steps: GridCell[] = [];
      for (let s = prevStep + 1; s <= nextStep; s++) {
        steps.push(getStepGridCell(token.color, token.index, s, token.status));
      }

      let stepIdx = 0;
      setPhase('forward');

      const interval = setInterval(() => {
        if (cancelled()) return clearInterval(interval);
        if (stepIdx < steps.length) {
          setCurrentCell(steps[stepIdx]);
          soundEngine.playTokenMove();
          stepIdx++;
        } else {
          clearInterval(interval);
          setPhase('idle');
        }
      }, 200);
      cancel.push(() => clearInterval(interval));
      return () => cancel.forEach((fn) => fn());
    }

    // ---- DEFAULT: direct position (leaving home, etc.) ----
    if (prevStatus === 'home' && token.status === 'active' && nextStep > 0) {
      setCurrentCell(getStepGridCell(token.color, token.index, token.stepCount, token.status));
      soundEngine.playLaunch();
      return;
    }
    setCurrentCell(getStepGridCell(token.color, token.index, token.stepCount, token.status));
    return;
  }, [token.stepCount, token.color, token.index, token.status]);

  const char = getCharacter(token.color);
  const offsets = STACK_OFFSETS[Math.min(totalInCell, 4)] || STACK_OFFSETS[1];
  const offset = offsets[stackOffsetIndex] || { dx: 0, dy: 0 };

  const tokenSizePct = cellWidthPct * 0.95;
  const topPct = currentCell.row * cellWidthPct - tokenSizePct / 2 + offset.dy * cellWidthPct;
  const leftPct = currentCell.col * cellWidthPct - tokenSizePct / 2 + offset.dx * cellWidthPct;

  const affected = phase !== 'idle';
  const isReturning = phase === 'returning';
  const isLanding = phase === 'landing';
  const isHit = phase === 'hit';

  // Characters fill the full cell; slightly smaller than the cell for a gap.
  const radius = tokenSizePct;
  const xTranslatePct = (leftPct / radius) * 100;
  const yTranslatePct = (topPct / radius) * 100;

  return (
    <motion.div
      animate={{
        x: `${xTranslatePct}%`,
        y: `${yTranslatePct}%`,
        scale: phase === 'landing'
          ? [0.6, 1.35, 1]
          : isHit || isReturning
            ? [1, 0.9, 1, 0.9, 1]
            : phase === 'forward'
              ? [1, 1.15, 1]
              : 1,
        rotate: isHit || isReturning ? [0, -14, 12, -6, 0] : phase === 'landing' ? [0, 10, -6, 0] : 0,
        opacity: isHit ? 0.6 : isReturning ? 0.85 : phase === 'landing' ? 0.9 : 1,
      }}
      transition={{
        x: { type: 'spring', stiffness: 320, damping: 24 },
        y: { type: 'spring', stiffness: 320, damping: 24 },
        scale: { duration: isHit ? 0.08 : isReturning ? 0.1 : phase === 'landing' ? 0.4 : 0.14, ease: 'easeInOut' },
        rotate: { duration: 0.5, ease: 'easeInOut' },
        opacity: { duration: 0.25, ease: 'easeOut' },
      }}
      onClick={() => isLegalMove && onSelect(token.id)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${radius}%`,
        height: `${radius}%`,
        zIndex: affected || isLegalMove ? 35 : 10 + stackOffsetIndex,
        cursor: isLegalMove ? 'pointer' : 'default',
        willChange: affected ? 'transform' : 'auto',
      }}
      className="flex items-center justify-center select-none"
    >
      {isLegalMove && (
        <>
          {/* Outer pulsing ring */}
          <motion.div
            animate={{ scale: [1, 1.45, 1], opacity: [0.85, 0.15, 0.85] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: '-12%',
              border: `2px solid ${colorStyle.primary}`,
              boxShadow: `0 0 14px ${colorStyle.primary}70, 0 0 28px ${colorStyle.primary}30`,
            }}
          />
          {/* Inner solid glow fill */}
          <motion.div
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut', delay: 0.18 }}
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${colorStyle.primary}55 0%, transparent 70%)`,
            }}
          />
        </>
      )}

      {/* Home landing splash */}
      {isLanding && (
        <>
          <motion.div
            key="landsplash"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              width: tokenSizePct * 2,
              height: tokenSizePct * 2,
              transform: 'translate(-50%, -50%)',
              border: `4px solid ${colorStyle.primary}`,
              background: `radial-gradient(circle, ${colorStyle.primary}44, transparent 70%)`,
              boxShadow: `0 0 30px ${colorStyle.primary}`,
            }}
          />
          {/* Landing sparkles */}
          <Sparkles color={char.secondary} count={6} />
        </>
      )}

      {/* Finish celebration (reached home center) */}
      {phase === 'finished' && (
        <>
          <motion.div
            key="finishsparkle"
            initial={{ scale: 0.3, opacity: 1 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              width: tokenSizePct * 2.4,
              height: tokenSizePct * 2.4,
              transform: 'translate(-50%, -50%)',
              border: `3px solid #FFC857`,
              background: `radial-gradient(circle, rgba(255,200,87,0.5), transparent 70%)`,
              boxShadow: `0 0 40px rgba(255,200,87,0.8)`,
            }}
          />
          <Confetti colors={['#FFC857', char.secondary, '#ffffff', colorStyle.primary]} count={12} />
          <Sparkles color="#FFC857" count={5} />
        </>
      )}

      {/* Character-based goti */}
      <motion.div
        animate={
          isLegalMove
            ? { y: [0, -5, 0], scale: [1, 1.05, 1] }
            : isReturning
              ? { y: [0, -6, 0] }
              : phase === 'finished'
                ? { y: [0, -4, 0], scale: [1, 1.06, 1] }
                : { y: 0 }
        }
        transition={
          isLegalMove || isReturning || phase === 'finished'
            ? { repeat: Infinity, duration: 0.85, ease: 'easeInOut' }
            : {}
        }
        className="relative w-full h-full flex items-center justify-center"
      >
        {/* resting halo for legal movers / finished */}
        {(isLegalMove || phase === 'finished') && (
          <div
            className="absolute -inset-[6%] rounded-full"
            style={{
              background: `radial-gradient(circle, ${char.primary}44 0%, transparent 70%)`,
              boxShadow: `0 0 18px ${char.primary}55`,
            }}
          />
        )}

        {isLegalMove && <Sparkles color={char.secondary} count={4} />}

        <CharacterToken
          characterId={char.id}
          playerColor={token.color}
          state={
            phase === 'finished'
              ? 'finished'
              : isHit || isReturning
                ? 'captured'
                : phase === 'forward'
                  ? 'moving'
                  : 'idle'
          }
          selected={isLegalMove}
          selectable={isLegalMove}
          moving={phase === 'forward' || isReturning}
          captured={isHit || isReturning}
          finished={phase === 'finished'}
        />
      </motion.div>

      {/* Capture impact the moment this character is cut */}
      {isHit && hitOrigin && (
        <>
          <ImpactRing color={char.primary} />
          <Sparkles color="#ffffff" count={6} />
          <Sparkles color="#ff5252" count={5} />
        </>
      )}
    </motion.div>
  );
};

export const TokenComponent = React.memo(TokenComponentBase, (prev, next) => {
  return (
    prev.token.id === next.token.id &&
    prev.token.stepCount === next.token.stepCount &&
    prev.token.status === next.token.status &&
    prev.token.index === next.token.index &&
    prev.token.color === next.token.color &&
    prev.isLegalMove === next.isLegalMove &&
    prev.stackOffsetIndex === next.stackOffsetIndex &&
    prev.totalInCell === next.totalInCell &&
    prev.shape === next.shape
  );
});