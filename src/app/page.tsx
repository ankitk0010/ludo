'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Bot, Users, Sparkles, Volume2, VolumeX, Trophy, Shield } from 'lucide-react';
import { ProfileDrawer } from '@/components/profile/ProfileDrawer';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { LobbySocial } from '@/components/lobby/LobbySocial';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { soundEngine } from '@/components/sound/soundEngine';
import { loadProfile, saveProfile, saveAuthToken, getAuthToken, clearAuthSession, DEFAULT_PROFILE, PlayerProfile } from '@/game/profile';
import { CHARACTER_LIST } from '@/game/characters';
import { PlayerColor } from '@/game/engine/types';
import { getDeviceId } from '@/lib/roomClient';
import { apiUpdateProfile, apiLogout } from '@/lib/authClient';

const FEATURES = [
  { icon: '⚡', title: 'Extra Move', desc: '+2 steps boost', color: '#f59e0b' },
  { icon: '🛡️', title: 'Shield Aura', desc: 'Capture protection', color: '#38d39f' },
  { icon: '🔄', title: 'Spot Swap', desc: 'Exchange places', color: '#3b82f6' },
  { icon: '🎲', title: 'Lucky Roll', desc: 'Pick any dice result', color: '#a855f7' },
];

interface LeaderboardUser {
  username: string;
  displayName: string | null;
  avatar: string;
  avatarUrl: string | null;
  characterId: string;
  wins: number;
  games: number;
  xp: number;
  level: number;
}

export default function LandingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [token, setToken] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [roomInput, setRoomInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const deviceId = useMemo(() => getDeviceId(), []);

  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(true);
      setProfile(loadProfile());
      setToken(getAuthToken());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleAuthenticated = (p: PlayerProfile, authToken: string) => {
    saveProfile(p);
    saveAuthToken(authToken);
    setProfile(p);
    setToken(authToken);
    soundEngine.playClick();
  };

  const handleLogout = async () => {
    if (token) await apiLogout(token).catch(() => {});
    clearAuthSession();
    setToken(null);
    setShowProfile(false);
    setProfile({ ...DEFAULT_PROFILE });
  };

  const handleUpdateProfile = (p: PlayerProfile) => {
    saveProfile(p);
    setProfile(p);
    if (token) {
      apiUpdateProfile(token, {
        characterId: p.characterId,
        displayName: p.displayName,
        avatar: p.avatarUrl,
      }).catch(() => {});
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    soundEngine.setMuted(nextMute);
  };

  const handleStartVsBots = () => {
    soundEngine.playClick();
    router.push('/game?mode=bots');
  };

  const handleStartPassPlay = () => {
    soundEngine.playClick();
    router.push('/game?mode=pass');
  };

  const handleCreateRoom = () => {
    soundEngine.playClick();
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/game?mode=room&code=${code}&host=true`);
  };

  const handleJoinRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim()) return;
    soundEngine.playClick();
    router.push(`/game?mode=room&code=${roomInput.toUpperCase()}&host=false`);
  };

  const displayName = profile.displayName || profile.username || 'Guest';
  const isRegistered = mounted && Boolean(profile.username);

  // Home leaderboard — top players, updated after mount (client-only fetch).
  useEffect(() => {
    if (!isRegistered) return;
    fetch('/api/games')
      .then((r) => r.json())
      .then((d) => setLeaderboard(d.leaderboard || []))
      .catch(() => setLeaderboard([]));
  }, [isRegistered]);

  const scrollToAuth = () => {
    if (typeof document !== 'undefined') {
      document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <main className="home-arena h-[100dvh] overflow-y-auto overflow-x-hidden text-white flex flex-col p-4 sm:p-8 select-none relative scroll-smooth">
      {/* Background Glow Accents: handled by the .home-arena backdrop (shared by all screens) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />

      {/* Top Header Navigation — normal in-flow navbar (scrolls with the page) */}
      <header className="relative z-40 px-3 sm:px-8 pt-3 sm:pt-6 pb-2 pointer-events-none">
        <div className="pointer-events-auto relative mx-auto max-w-5xl w-full flex items-center justify-between gap-2 px-2.5 sm:px-4 py-2 rounded-2xl bg-transparent">

          <div className="relative flex items-center gap-2 min-w-0">
            <div className="relative shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-indigo-600 flex items-center justify-center leading-none text-lg sm:text-xl shadow-lg shadow-purple-600/30 border border-white/20">
              <span>🎲</span>
            </div>
            <div className="min-w-0 leading-none">
              <div className="flex items-center gap-1.5">
                <h1 className="text-[15px] sm:text-lg font-black tracking-tight text-white truncate">LUDO MASTER</h1>
                <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="block text-[8px] sm:text-[10px] font-bold text-purple-300 uppercase tracking-[0.18em] truncate">
                POWER CARDS EDITION
              </span>
            </div>
          </div>

          <div className="relative flex items-center gap-1 sm:gap-2 shrink-0">
            {isRegistered && (
              <span className="hidden xl:inline text-[11px] font-bold text-slate-400 mr-1 max-w-[100px] truncate">
                Hi, <span className="text-white">{displayName}</span>
              </span>
            )}
            <button
              onClick={toggleMute}
              className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950/70 border border-slate-700/70 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/50 hover:shadow-[0_0_14px_rgba(16,185,129,0.25)] transition-all active:scale-90"
              aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
            </button>
            <button
              onClick={() => router.push('/admin')}
              className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950/70 border border-slate-700/70 text-slate-400 hover:text-purple-300 hover:border-purple-500/60 hover:shadow-[0_0_14px_rgba(139,92,246,0.3)] transition-all active:scale-90"
              aria-label="Admin panel"
              title="Admin panel"
            >
              <Shield className="w-5 h-5" />
            </button>
            {isRegistered ? (
              <div className="relative rounded-xl p-[2px] bg-gradient-to-br from-amber-300 via-fuchsia-500 to-purple-500 shadow-lg shadow-purple-600/40 hover:shadow-purple-500/60 transition-shadow">
                <CharacterAvatar
                  color={profile.characterId}
                  image={profile.avatarUrl}
                  onClick={() => setShowProfile(true)}
                  aria-label="Open profile"
                  className="w-8 h-8"
                />
              </div>
            ) : (
              <button
                onClick={scrollToAuth}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 hover:from-fuchsia-500 hover:via-purple-500 hover:to-indigo-500 text-white text-[11px] font-black tracking-wide shadow-lg shadow-purple-600/40 transition-all active:scale-95"
              >
                Log in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content — auth first, then hero */}
      {!isRegistered ? (
        <section id="auth-card" className="relative z-10 py-10">
          <AuthScreen initial={profile} onAuthenticated={handleAuthenticated} />
        </section>
      ) : (
        <>
          {/* Hero Content */}
          <section className="relative z-10 max-w-xl mx-auto text-center space-y-7 py-10">
            {/* Floating game pieces */}
            <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden>
              <motion.span
                animate={{ y: [0, -16, 0], rotate: [0, 24, -12, 0] }}
                transition={{ repeat: Infinity, duration: 6 }}
                className="absolute left-[6%] top-[16%] text-4xl opacity-50 drop-shadow-[0_0_12px_rgba(168,85,247,0.55)]"
              >
                🎲
              </motion.span>
              <motion.span
                animate={{ y: [0, -12, 0], rotate: [0, -20, 10, 0] }}
                transition={{ repeat: Infinity, duration: 7, delay: 1.2 }}
                className="absolute right-[8%] top-[10%] text-3xl opacity-50 drop-shadow-[0_0_12px_rgba(255,200,87,0.55)]"
              >
                ⚄
              </motion.span>
              <motion.span
                animate={{ y: [0, -10, 0], rotate: [0, 14, -8, 0] }}
                transition={{ repeat: Infinity, duration: 8, delay: 2 }}
                className="absolute left-[14%] bottom-[18%] text-3xl opacity-40 drop-shadow-[0_0_12px_rgba(59,130,246,0.55)]"
              >
                ⚀
              </motion.span>
              <motion.span
                animate={{ y: [0, -14, 0], rotate: [0, -18, 12, 0] }}
                transition={{ repeat: Infinity, duration: 6.5, delay: 0.6 }}
                className="absolute right-[16%] bottom-[12%] text-3xl opacity-50 drop-shadow-[0_0_12px_rgba(56,211,153,0.55)]"
              >
                ⚃
              </motion.span>
            </div>

            {/* Player identity chip */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 shadow-lg">
              <CharacterAvatar
                color={profile.characterId}
                image={profile.avatarUrl}
                onClick={() => setShowProfile(true)}
                aria-label="Edit your character"
                className="w-8 h-8"
              />
              <div className="text-left leading-none">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Playing as</div>
                <div className="text-xs font-extrabold text-white">{displayName}</div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Lv {profile.level}
              </span>
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-4 py-1.5 rounded-full text-xs font-extrabold text-purple-300">
                <Sparkles className="w-4 h-4 text-amber-400" /> NEW: 5 EXCITING POWER CARDS
              </div>
              <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-white">
                PLAY LUDO WITH <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
                  MAGIC POWER CARDS
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
                Experience fast-paced Ludo with Shielding, Extra Moves, Spot Swapping, and Lucky Rolls. Play offline vs AI or online with friends!
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              <button
                onClick={handleStartVsBots}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 font-black text-white text-base tracking-wider shadow-xl shadow-purple-600/40 hover:shadow-fuchsia-500/40 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Bot className="w-5 h-5" /> PLAY VS AI BOTS
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCreateRoom}
                  className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-amber-400" /> CREATE ROOM
                </button>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-400" /> JOIN ROOM
                </button>
              </div>

              <button
                onClick={handleStartPassPlay}
                className="w-full py-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 font-bold text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                ⚄ PASS & PLAY (SAME DEVICE)
              </button>
            </div>

            {/* Feature chips */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {['🔊 LIVE VOICE REACTIONS', '🃏 5 POWER CARDS', '⚡ INSTANT ROOMS'].map((chip) => (
                <span
                  key={chip}
                  className="px-3 py-1 rounded-full bg-slate-900/70 border border-slate-800 text-[9px] font-black text-slate-300 tracking-wider"
                >
                  {chip}
                </span>
              ))}
            </div>
          </section>

          {/* Character roster + Features Showcase Grid */}
          <footer className="relative z-10 w-full max-w-4xl mx-auto space-y-7 pt-6 border-t border-slate-900">
            {/* Meet your characters */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <span className="text-sm leading-none">🎨</span> Choose your goti colour
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 sm:gap-6">
                {CHARACTER_LIST.map((c) => (
                  <button
                    key={c.color}
                    onClick={() => setShowProfile(true)}
                    className="group flex flex-col items-center gap-1.5 cursor-pointer"
                    aria-label={`Edit character`}
                  >
                    <CharacterAvatar
                      color={c.color}
                      selected={profile.characterId === c.color}
                      className={`w-14 h-14 sm:w-16 sm:h-16 transition-transform group-hover:scale-110 ${
                        profile.characterId === c.color ? '' : 'opacity-75'
                      }`}
                    />
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider ${
                        profile.characterId === c.color ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      {c.title.split(' ').pop()}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Power cards */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                <span className="text-sm leading-none">🃏</span> Power cards of the arena
              </div>
            </div>

            {/* Power card feature cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FEATURES.map((f, idx) => (
                <motion.div
                  key={f.title}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative bg-slate-900/50 p-3.5 rounded-2xl border border-slate-800 text-center overflow-hidden"
                >
                  <div
                    className="absolute -top-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full blur-2xl opacity-40 pointer-events-none"
                    style={{ background: f.color }}
                  />
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut', delay: idx * 0.35 }}
                    className="text-2xl mb-1.5"
                  >
                    {f.icon}
                  </motion.div>
                  <div className="text-xs font-bold text-white">{f.title}</div>
                  <div className="text-[10px] text-slate-500">{f.desc}</div>
                </motion.div>
              ))}
            </div>

            {/* Leaderboard — top players */}
            {leaderboard.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-b from-slate-900/70 to-slate-950/60 border border-slate-800 rounded-2xl p-4">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />
                <h3 className="relative text-xs font-black uppercase tracking-widest text-amber-300 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5" />
                  </span>
                  Hall of fame
                </h3>
                <div className="space-y-1.5">
                  {leaderboard.map((u, i) => {
                    const me = u.username === profile.username;
                    return (
                      <div
                        key={u.username}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-xl ${
                          me ? 'bg-purple-500/15 border border-purple-500/40' : 'bg-slate-950/50 border border-slate-800'
                        }`}
                      >
                        <span className="w-7 text-center text-sm shrink-0">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                        </span>
                        <CharacterAvatar
                          color={(u.characterId as PlayerColor) || 'red'}
                          image={me ? profile.avatarUrl : u.avatarUrl || undefined}
                          className="w-9 h-9 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{u.displayName || u.username}</div>
                          <div className="text-[9px] text-slate-500">
                            {u.wins} wins · {u.games} games · Lv {u.level}
                          </div>
                        </div>
                        {me && (
                          <span className="text-[9px] font-black text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </footer>
        </>
      )}

      {/* Join Room Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
            >
              <h3 className="text-xl font-black text-white text-center">JOIN PRIVATE ROOM</h3>
              <form onSubmit={handleJoinRoomSubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder="ENTER ROOM CODE (e.g. ABC123)"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  maxLength={6}
                  className="w-full py-3.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-black text-center text-lg uppercase tracking-wider focus:outline-none focus:border-purple-500 placeholder:text-slate-600 placeholder:text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="w-1/2 py-3 rounded-xl bg-slate-800 font-bold text-slate-300 text-sm"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-extrabold text-white text-sm"
                  >
                    JOIN
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProfileDrawer
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        username={profile.username || 'Player'}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        onLogout={handleLogout}
      />

      {/* Floating incoming room-invite notifier for friends */}
      <LobbySocial variant="notify" deviceId={deviceId} profile={profile} />
    </main>
  );
}