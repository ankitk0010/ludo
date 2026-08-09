'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SparklesProps {
  color: string;
  count?: number;
  className?: string;
}

/*
 * Tiny sparkle particles that twinkle softly. GPU-friendly (transform/opacity).
 */
export const Sparkles: React.FC<SparklesProps> = ({ color, count = 4, className = '' }) => {
  const seeds = React.useMemo(() => Array.from({ length: count }, (_, i) => (i * 37 + 11) % 100), [count]);
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      {seeds.map((seed, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 55 + (seed % 18);
        const x = 50 + Math.cos(angle) * dist * 0.5;
        const y = 50 + Math.sin(angle) * dist * 0.5;
        const delay = (seed % 100) / 100;
        return (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1.4, delay, ease: 'easeInOut' }}
            className="absolute"
            style={{ left: `${x}%`, top: `${y}%`, color }}
          >
            ✦
          </motion.div>
        );
      })}
    </div>
  );
};

interface ConfettiProps {
  colors: string[];
  count?: number;
  className?: string;
}

/*
 * Firing confetti poof. Used for selection / small wins.
 */
export const Confetti: React.FC<ConfettiProps> = ({ colors, count = 12, className = '' }) => {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: 50 + (i * 17) % 40 - 20,
        delay: (i * 13) % 100 / 100,
        color: colors[i % colors.length],
        rotate: (i * 45) % 180,
      })),
    [colors, count]
  );
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 0.6, opacity: 1 }}
          animate={{ x: [0, p.x * 2, p.x * 3.2], y: [0, -34 - p.delay * 20, -30], opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: p.delay * 0.3 }}
          className="absolute w-1.5 h-1.5 rounded-[2px]"
          style={{ left: '50%', top: '50%', background: p.color }}
        />
      ))}
    </div>
  );
};

interface ImpactRingProps {
  color: string;
  className?: string;
}

/*
 * Expanding ring + flash for captures / landings.
 */
export const ImpactRing: React.FC<ImpactRingProps> = ({ color, className = '' }) => (
  <div className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}>
    <motion.div
      initial={{ scale: 0.3, opacity: 0.9 }}
      animate={{ scale: 2.4, opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="absolute w-[90%] h-[90%] rounded-full border-[3px]"
      style={{ borderColor: color, boxShadow: `0 0 24px ${color}` }}
    />
    <motion.div
      initial={{ scale: 0.4, opacity: 1 }}
      animate={{ scale: 1.8, opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.08 }}
      className="absolute w-[60%] h-[60%] rounded-full"
      style={{ background: `radial-gradient(circle, ${color}66, transparent 70%)` }}
    />
    <motion.div
      initial={{ scale: 0.5, opacity: 1 }}
      animate={{ scale: 1, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeIn' }}
      className="absolute w-[40%] h-[40%] rounded-full bg-white"
    />
  </div>
);

interface DustTrailProps {
  color: string;
  className?: string;
}

/*
 * Small puffs for behind a moving token.
 */
export const DustTrail: React.FC<DustTrailProps> = ({ color, className = '' }) => (
  <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        initial={{ scale: 0.4, opacity: 0.7 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ repeat: Infinity, duration: 0.55, delay: i * 0.18, ease: 'easeOut' }}
        className="absolute w-2 h-2 rounded-full"
        style={{
          left: `${18 + i * 26}%`,
          top: '84%',
          background: color,
          opacity: 0.4,
        }}
      />
    ))}
  </div>
);

export const Effects = {
  Sparkles,
  Confetti,
  ImpactRing,
  DustTrail,
};