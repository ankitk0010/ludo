'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, CheckCircle2, RotateCcw, Home, Frown } from 'lucide-react';
import { Player, PlayerColor } from '@/game/engine/types';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { gameTheme } from '@/theme/tokens';
import { soundEngine } from '../sound/soundEngine';

interface VictoryModalProps {
  winnerColor: PlayerColor;
  myColor?: PlayerColor;
  players: Player[];
  onPlayAgain: () => void;
  onReturnHome: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winnerColor,
  myColor,
  players,
  onPlayAgain,
  onReturnHome,
}) => {
  const winner = players.find((p) => p.color === winnerColor);
  const isMyWin = !myColor || myColor === winnerColor;

  useEffect(() => {
    if (isMyWin) {
      soundEngine.playVictory();
      // Launch celebratory fireworks for the winner
      const duration = 3 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 6,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 6,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    } else {
      soundEngine.playDefeat();
    }
  }, [winnerColor, isMyWin]);

  // Order players: winner first, then remaining players
  const sortedPlayers = React.useMemo(() => {
    return players.slice().sort((a, b) => {
      if (a.color === winnerColor) return -1;
      if (b.color === winnerColor) return 1;
      return (b.wins || 0) - (a.wins || 0);
    });
  }, [players, winnerColor]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`bg-slate-900 border-4 rounded-3xl p-5 sm:p-6 max-w-md w-full text-center shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto ${
          isMyWin ? 'border-amber-400' : 'border-rose-500/70'
        }`}
      >
        <div className="text-5xl animate-bounce">{isMyWin ? '🏆' : '💔'}</div>

        {winner && (
          <div className="relative mx-auto w-fit">
            <CharacterAvatar
              color={winner.color}
              glow={isMyWin}
              image={winner.avatarUrl}
              className="w-20 h-20"
            />
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.3 }}
              className="absolute -top-2 -right-2 text-2xl"
            >
              👑
            </motion.span>
          </div>
        )}

        <div>
          <h2
            className={`text-2xl sm:text-3xl font-black tracking-wide uppercase ${
              isMyWin ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            {isMyWin ? 'VICTORY!' : 'MATCH OVER - DEFEAT'}
          </h2>
          <p className="text-base sm:text-lg font-bold text-white mt-1">
            {isMyWin
              ? 'YOU WON THE MATCH!'
              : `${winner?.name || winnerColor.toUpperCase()} WON THE MATCH!`}
          </p>
          {!isMyWin && (
            <p className="text-xs font-semibold text-slate-300 mt-0.5">
              Better luck next time! 🌟
            </p>
          )}

          {players.filter((p) => p.color !== winnerColor).length > 0 &&
            players.filter((p) => p.color !== winnerColor).every((p) => p.connected === false) && (
              <p className="text-xs font-extrabold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl mt-2">
                ⚡ Opponent(s) left the room — Victory awarded!
              </p>
            )}

          {winner && (
            <div
              className="mt-2 inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-md"
              style={{
                color: gameTheme.players[winner.color]?.primary,
                borderColor: `${gameTheme.players[winner.color]?.primary}66`,
                background: `${gameTheme.players[winner.color]?.primary}14`,
              }}
            >
              {winner.color} CHAMPION
            </div>
          )}
        </div>

        {/* Individual Player Rewards Breakdown */}
        <div className="bg-slate-950/90 rounded-2xl p-3.5 border border-slate-800 space-y-2 text-xs text-left">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
            <span>Match Results & Rewards</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Saved to Leaderboard
            </span>
          </div>

          <div className="space-y-1.5">
            {sortedPlayers.map((p, idx) => {
              const isWinnerSeat = p.color === winnerColor;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${
                    isWinnerSeat
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <span className="text-xs font-black shrink-0 w-5 text-center">
                    {isWinnerSeat ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '4️⃣'}
                  </span>
                  <CharacterAvatar color={p.color} image={p.avatarUrl} className="w-7 h-7 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                      <span className="truncate">{p.name}</span>
                      {isWinnerSeat && (
                        <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 shrink-0">
                          WINNER
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] font-semibold text-slate-400">
                      {p.connected === false ? '🔴 Offline' : '🟢 Active'} · {p.color} seat
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-black ${isWinnerSeat ? 'text-amber-300' : 'text-slate-300'}`}>
                      {isWinnerSeat ? '+250 XP' : '+50 XP'}
                    </div>
                    <div className="text-[8px] font-bold text-emerald-400">
                      {isWinnerSeat ? '+1 WIN' : '+1 GAME'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[10px] font-semibold text-slate-400">
          ✅ Player stats & leaderboard rankings updated.
        </p>

        <div className="flex flex-col gap-2.5 pt-1">
          <button
            onClick={onPlayAgain}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-extrabold text-white text-sm shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <RotateCcw className="w-4 h-4" /> PLAY AGAIN
          </button>
          <button
            onClick={onReturnHome}
            className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 font-bold text-slate-300 text-xs flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Home className="w-4 h-4" /> RETURN TO LOBBY
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VictoryModal;
