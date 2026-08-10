'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Player, PlayerColor } from '@/game/engine/types';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { gameTheme } from '@/theme/tokens';
import { soundEngine } from '../sound/soundEngine';

interface VictoryModalProps {
  winnerColor: PlayerColor;
  players: Player[];
  onPlayAgain: () => void;
  onReturnHome: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winnerColor,
  players,
  onPlayAgain,
  onReturnHome,
}) => {
  const winner = players.find((p) => p.color === winnerColor);

  useEffect(() => {
    soundEngine.playVictory();
    // Launch celebratory fireworks
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, [winnerColor]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border-4 border-amber-400 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-6"
      >
        <div className="text-6xl animate-bounce">🏆</div>
        {winner && (
          <div className="relative mx-auto w-fit">
            <CharacterAvatar
              color={winner.color}
              glow
              image={winner.avatarUrl}
              className="w-20 h-20"
            />
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.4 }}
              className="absolute -top-2 -right-2 text-2xl"
            >
              👑
            </motion.span>
          </div>
        )}
        <div>
          <h2 className="text-3xl font-black text-amber-300 tracking-wide uppercase">VICTORY!</h2>
          <p className="text-lg font-bold text-white mt-1">
            {winner?.name || winnerColor.toUpperCase()} WINS THE MATCH!
          </p>
          {players.filter((p) => p.color !== winnerColor).length > 0 &&
            players.filter((p) => p.color !== winnerColor).every((p) => p.connected === false) && (
              <p className="text-xs font-extrabold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl mt-2">
                ⚡ Opponent(s) left the room — Victory awarded!
              </p>
            )}
          {winner && (
            <div
              className="mt-1.5 inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border"
              style={{
                color: gameTheme.players[winner.color]?.primary,
                borderColor: `${gameTheme.players[winner.color]?.primary}66`,
                background: `${gameTheme.players[winner.color]?.primary}14`,
              }}
            >
              {winner.color}
            </div>
          )}
        </div>

        <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Winner Color</span>
            <span className="font-bold text-amber-400 uppercase">{winnerColor}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>XP Earned</span>
            <span className="font-bold text-emerald-400">+250 XP</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Coins Awarded</span>
            <span className="font-bold text-yellow-400">🪙 500 Coins</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-extrabold text-white text-base shadow-lg shadow-purple-600/30 transition-transform active:scale-95"
          >
            PLAY AGAIN 🔄
          </button>
          <button
            onClick={onReturnHome}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 font-bold text-slate-300 text-sm transition-transform active:scale-95"
          >
            RETURN TO LOBBY
          </button>
        </div>
      </motion.div>
    </div>
  );
};
