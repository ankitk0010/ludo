'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X } from 'lucide-react';
import { Player, PlayerColor } from '@/game/engine/types';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';

interface LeaderboardEntry {
  id: string;
  name: string;
  wins: number;
  xp: number;
  rank: number;
  isYou?: boolean;
  color: PlayerColor;
  avatar?: string;
  avatarUrl?: string;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
}

function buildEntries(players: Player[]): LeaderboardEntry[] {
  return players
    .map((p) => ({
      id: p.id,
      name: p.name,
      wins: p.wins,
      xp: p.xp,
      isYou: !p.isBot,
      color: p.color,
      avatar: p.avatar,
      avatarUrl: p.avatarUrl,
    }))
    .sort((a, b) => b.xp - a.xp)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

const MEDALS = ['🥇', '🥈', '🥉'];

export const Leaderboard: React.FC<LeaderboardProps> = ({ isOpen, onClose, players }) => {
  const entries = React.useMemo(() => buildEntries(players), [players]);
  const top3 = entries.slice(0, 3);

  // Podium layout order: 2nd (left), 1st (center), 3rd (right)
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardEntry[];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-slate-900 border border-slate-700 rounded-3xl p-5 w-full max-w-sm max-h-[82dvh] overflow-y-auto shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center"
              aria-label="Close leaderboard"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="inline-flex items-center gap-2 text-amber-300 font-black text-lg">
                <Trophy className="w-5 h-5" /> LEADERBOARD
              </div>
            </div>

            {/* Podium */}
            {podiumOrder.length > 0 && (
              <div className="flex items-end justify-center gap-2 mb-5 h-44">
                {podiumOrder.map((e, i) => {
                  const rank = e.rank;
                  const isFirst = rank === 1;
                  const medal = MEDALS[rank - 1];
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.14, type: 'spring', stiffness: 280, damping: 20 }}
                      className={`flex flex-col items-center w-24 ${isFirst ? '-mt-2' : ''}`}
                    >
                      {/* Medallion + avatar */}
                      <motion.div
                        animate={isFirst ? { scale: [1, 1.06, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut', delay: 0.8 }}
                        className="relative"
                      >
                        <CharacterAvatar color={e.color} glow image={e.avatarUrl} className="w-12 h-12" />
                        <span className="absolute -top-2 -right-2 text-lg drop-shadow">{medal}</span>
                      </motion.div>
                      <div
                        className={`mt-2 px-2 py-0.5 rounded-lg ${e.isYou ? 'bg-purple-600/40 border border-purple-500/50' : 'bg-slate-800'}`}
                      >
                        <span className="text-[11px] font-black text-white">{(e.name || '?').split(' (')[0]}</span>
                        {e.isYou && <span className="ml-1 text-[8px] font-black text-purple-300">(YOU)</span>}
                      </div>
                      <span className="text-[9px] font-bold text-amber-300 mt-0.5">{e.xp} XP</span>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Remaining ranks */}
            <div className="space-y-1">
              {entries.map((e) =>
                e.rank > 3 ? (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + (e.rank - 4) * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                      e.isYou
                        ? 'bg-purple-600/25 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                        : 'bg-slate-950/70'
                    }`}
                  >
                    <span className="w-5 text-center font-black text-slate-400">{e.rank}</span>
                    <CharacterAvatar color={e.color} image={e.avatarUrl} className="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">
                        {e.name.split(' (')[0]}
                        {e.isYou && <span className="ml-1.5 text-[9px] font-black text-purple-300">(YOU)</span>}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500">{e.wins} wins</div>
                    </div>
                    <span className="text-[12px] font-black text-amber-300">{e.xp}</span>
                  </motion.div>
                ) : null
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Leaderboard;