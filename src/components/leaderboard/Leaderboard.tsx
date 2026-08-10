'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Globe, Users } from 'lucide-react';
import { Player, PlayerColor } from '@/game/engine/types';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { loadProfile, profileName } from '@/game/profile';

interface LeaderboardEntry {
  id: string;
  name: string;
  wins: number;
  games: number;
  xp: number;
  rank: number;
  isYou?: boolean;
  color: PlayerColor;
  avatarUrl?: string;
  level?: number;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
}

function buildMatchEntries(players: Player[], myName: string): LeaderboardEntry[] {
  return players
    .map((p) => ({
      id: p.id,
      name: p.name,
      wins: p.wins,
      games: 1,
      xp: p.xp,
      isYou: p.name.trim().toLowerCase() === myName.trim().toLowerCase(),
      color: p.color,
      avatarUrl: p.avatarUrl,
    }))
    .sort((a, b) => b.xp - a.xp || b.wins - a.wins)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

const MEDALS = ['🥇', '🥈', '🥉'];
const COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const Leaderboard: React.FC<LeaderboardProps> = ({ isOpen, onClose, players }) => {
  const [tab, setTab] = useState<'global' | 'match'>('global');
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const localProfile = typeof window !== 'undefined' ? loadProfile() : null;
  const myName = localProfile ? profileName(localProfile) : '';

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    setLoading(true);
    fetch('/api/games')
      .then((res) => res.json())
      .then((data) => {
        if (!live) return;
        const list = (data.leaderboard || []) as Array<{
          id?: string;
          username: string;
          displayName?: string;
          wins: number;
          games?: number;
          xp: number;
          level?: number;
          avatarUrl?: string;
          characterId?: PlayerColor;
        }>;

        const entries: LeaderboardEntry[] = list.map((u, i) => {
          const name = u.displayName || u.username;
          const isYou = myName && (u.username.toLowerCase() === myName.toLowerCase() || name.toLowerCase() === myName.toLowerCase());
          return {
            id: u.id || u.username,
            name,
            wins: u.wins || 0,
            games: u.games || 0,
            xp: u.xp || 0,
            level: u.level || 1,
            rank: i + 1,
            isYou: Boolean(isYou),
            color: u.characterId && COLORS.includes(u.characterId) ? u.characterId : COLORS[i % COLORS.length],
            avatarUrl: u.avatarUrl || undefined,
          };
        });
        setGlobalEntries(entries);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [isOpen, myName]);

  const matchEntries = React.useMemo(() => buildMatchEntries(players, myName), [players, myName]);
  const entries = tab === 'global' ? globalEntries : matchEntries;
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
          className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
        >
          <motion.div
            initial={{ scale: 0.9, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-5 w-full max-w-sm max-h-[85dvh] overflow-y-auto shadow-2xl space-y-4"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Close leaderboard"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pt-1">
              <div className="inline-flex items-center gap-2 text-amber-300 font-black text-lg">
                <Trophy className="w-5 h-5 text-amber-400 animate-pulse" /> LUDO LEADERBOARD
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 gap-1">
              <button
                onClick={() => setTab('global')}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  tab === 'global'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3 h-3" /> Global Server
              </button>
              <button
                onClick={() => setTab('match')}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  tab === 'match'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3 h-3" /> Current Match
              </button>
            </div>

            {loading && tab === 'global' ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse">
                Fetching global rankings…
              </div>
            ) : entries.length === 0 ? (
              <div className="py-10 text-center text-xs font-semibold text-slate-500 italic">
                No leaderboard entries yet. Play a match to get ranked!
              </div>
            ) : (
              <>
                {/* Podium */}
                {podiumOrder.length > 0 && (
                  <div className="flex items-end justify-center gap-2 pt-2 pb-1 h-44">
                    {podiumOrder.map((e, i) => {
                      const rank = e.rank;
                      const isFirst = rank === 1;
                      const medal = MEDALS[rank - 1];
                      return (
                        <motion.div
                          key={e.id}
                          initial={{ opacity: 0, y: 50 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1, type: 'spring', stiffness: 280, damping: 20 }}
                          className={`flex flex-col items-center w-24 ${isFirst ? '-mt-2' : ''}`}
                        >
                          {/* Medallion + avatar */}
                          <div className="relative">
                            <CharacterAvatar color={e.color} glow image={e.avatarUrl} className="w-12 h-12" />
                            <span className="absolute -top-2 -right-2 text-lg drop-shadow">{medal}</span>
                          </div>
                          <div
                            className={`mt-2 px-2 py-0.5 rounded-lg max-w-full text-center truncate ${
                              e.isYou ? 'bg-purple-600/40 border border-purple-500/50' : 'bg-slate-800'
                            }`}
                          >
                            <span className="text-[10px] font-black text-white block truncate">
                              {(e.name || '?').split(' (')[0]}
                            </span>
                            {e.isYou && <span className="text-[8px] font-black text-purple-300 block">(YOU)</span>}
                          </div>
                          <span className="text-[9px] font-bold text-amber-300 mt-0.5">
                            {e.wins} Wins · {e.xp} XP
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Remaining ranks */}
                <div className="space-y-1.5 pt-1">
                  {entries.map((e) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border ${
                        e.isYou
                          ? 'bg-purple-600/20 border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                          : 'bg-slate-950/70 border-slate-800/80'
                      }`}
                    >
                      <span className="w-5 text-center font-black text-xs text-amber-400">#{e.rank}</span>
                      <CharacterAvatar color={e.color} image={e.avatarUrl} className="w-8 h-8 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                          <span className="truncate">{e.name.split(' (')[0]}</span>
                          {e.isYou && (
                            <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 border border-purple-400/40 shrink-0">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] font-semibold text-slate-400">
                          {e.wins} wins · {e.games || 1} games {e.level ? `· Lv ${e.level}` : ''}
                        </div>
                      </div>
                      <span className="text-xs font-black text-amber-300 shrink-0">{e.xp} XP</span>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Leaderboard;