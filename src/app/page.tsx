'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Bot, Users, Sparkles, Volume2, VolumeX, Trophy, Shield } from 'lucide-react';
import { ProfileDrawer } from '@/components/profile/ProfileDrawer';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { soundEngine } from '@/components/sound/soundEngine';
import { loadProfile, saveProfile, saveAuthToken, getAuthToken, clearAuthSession, DEFAULT_PROFILE, PlayerProfile } from '@/game/profile';
import { CHARACTER_LIST } from '@/game/characters';
import { PlayerColor } from '@/game/engine/types';
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
    if (token) await apiLogout(token);
    clearAuthSession();
    setToken(null);
    setShowProfile(false);
    setProfile({ ...profile, username: '', displayName: '' });
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
    <main className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-slate-950 text-white flex flex-col p-4 sm:p-8 select-none relative scroll-smooth">
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="relative z-20 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg border border-purple-300/40">
            🎲
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">LUDO MASTER</h1>
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
              POWER CARDS EDITION
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRegistered && (
            <span className="hidden sm:inline text-[11px] font-bold text-slate-400 mr-1 max-w-[120px] truncate">
              Hi, <span className="text-white">{displayName}</span>
            </span>
          )}
          <button
            onClick={toggleMute}
            className="p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-purple-300 hover:border-purple-500/60 transition-colors"
            aria-label="Admin panel"
            title="Admin panel"
          >
            <Shield className="w-5 h-5" />
          </button>
          {isRegistered ? (
            <div className="relative rounded-full bg-slate-900 border border-slate-800 hover:border-purple-500/60 transition-colors p-1">
              <CharacterAvatar
                color={profile.characterId}
                image={profile.avatarUrl}
                onClick={() => setShowProfile(true)}
                aria-label="Open profile"
                className="w-9 h-9"
              />
            </div>
          ) : (
            <button
              onClick={scrollToAuth}
              className="px-3 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-200 text-xs font-black tracking-wide hover:border-purple-500/60 transition-colors"
            >
              Log in / Sign up
            </button>
          )}
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
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-black text-white text-base tracking-wider shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
              >
                <Bot className="w-5 h-5" /> PLAY VS AI BOTS
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCreateRoom}
                  className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-amber-400" /> CREATE ROOM
                </button>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-400" /> JOIN ROOM
                </button>
              </div>

              <button
                onClick={handleStartPassPlay}
                className="w-full py-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 font-bold text-slate-400 text-xs transition-colors cursor-pointer"
              >
                PASS & PLAY (SAME DEVICE)
              </button>
            </div>
          </section>

          {/* Character roster + Features Showcase Grid */}
          <footer className="relative z-10 w-full max-w-4xl mx-auto space-y-6 pt-6 border-t border-slate-900">
            {/* Meet your characters */}
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                Meet your characters
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
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-300 mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> TOP PLAYERS
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
    </main>
  );
}