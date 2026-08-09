'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  LogOut,
  LayoutDashboard,
  Mic,
  Music,
  Users,
  Loader,
  Search,
  Trophy,
  Gamepad2,
  MessageSquareText,
} from 'lucide-react';
import { VoiceAdminPanel } from '@/components/admin/VoiceAdminPanel';
import { SfxAdminPanel } from '@/components/admin/SfxAdminPanel';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { isImageAvatar } from '@/game/avatars';
import { PlayerColor } from '@/game/engine/types';
import { clearAuthSession } from '@/game/profile';
import { apiLogout } from '@/lib/authClient';

const TOKEN_KEY = 'ludo_auth_token_v1';

type Tab = 'overview' | 'voice' | 'sfx' | 'players';

interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  avatar: string;
  characterId: string;
  level: number;
  wins: number;
  games: number;
  xp: number;
}

interface Stats {
  users: number;
  rooms: number;
  matches: number;
  voicePhrases: number;
  activePhrases: number;
  sfx: number;
}

interface PlayerRow {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  avatar: string;
  characterId: string;
  level: number;
  wins: number;
  games: number;
  xp: number;
  createdAt: string;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export default function AdminPage() {
  const [phase, setPhase] = useState<'loading' | 'login' | 'dashboard'>('loading');
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<PlayerRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [playerQuery, setPlayerQuery] = useState('');
  const [playersBusy, setPlayersBusy] = useState(false);

  const headers = useMemo(
    () => (token: string) => ({ Authorization: `Bearer ${token}` }),
    []
  );

  const checkSession = async (token: string | null) => {
    if (!token) return false;
    try {
      const res = await fetch('/api/admin/session', { headers: headers(token) });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.admin) {
        setAdmin(data.admin);
        return true;
      }
    } catch {
      /* offline */
    }
    return false;
  };

  useEffect(() => {
    const t = setTimeout(async () => {
      const token = getToken();
      const ok = await checkSession(token);
      setPhase(ok ? 'dashboard' : 'login');
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/stats', { headers: headers(token) });
      const data = await res.json();
      if (res.ok && data.stats) {
        setStats(data.stats);
        setRecent(data.recent || []);
      }
    } catch {
      /* ignore */
    }
  };

  const loadPlayers = async (q = '') => {
    const token = getToken();
    if (!token) return;
    setPlayersBusy(true);
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&take=30`, { headers: headers(token) });
      const data = await res.json();
      if (res.ok) setPlayers(data.users || []);
    } catch {
      /* ignore */
    } finally {
      setPlayersBusy(false);
    }
  };

  useEffect(() => {
    if (phase !== 'dashboard') return;
    const t = setTimeout(() => {
      if (tab === 'overview') void loadStats();
      if (tab === 'players') void loadPlayers(playerQuery);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tab, playerQuery]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user.trim() || !pass) {
      setError('Enter your username and password');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.trim(), password: pass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      // Keep the token only if the account is an admin.
      const sessionRes = await fetch('/api/admin/session', { headers: headers(data.token) });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.admin) {
        setToken(null);
        setError('This account does not have administrator access.');
        return;
      }

      setToken(data.token);
      setAdmin(sessionData.admin);
      setPhase('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    const token = getToken();
    if (token) await apiLogout(token).catch(() => {});
    setToken(null);
    setAdmin(null);
    setPhase('login');
    setTab('overview');
    // Wipe the shared game session/profile so no old player identity lingers.
    clearAuthSession();
  };

  const runPlayerSearch = () => {
    void loadPlayers(playerQuery);
  };

  const statCards: { label: string; value: number; icon: React.ReactNode; color: string }[] = [
    { label: 'Players', value: stats?.users ?? 0, icon: <Users className="w-5 h-5" />, color: '#3b82f6' },
    { label: 'Rooms created', value: stats?.rooms ?? 0, icon: <Gamepad2 className="w-5 h-5" />, color: '#a855f7' },
    { label: 'Matches played', value: stats?.matches ?? 0, icon: <Trophy className="w-5 h-5" />, color: '#ffc857' },
    { label: 'Voice phrases', value: stats?.voicePhrases ?? 0, icon: <MessageSquareText className="w-5 h-5" />, color: '#38d39f' },
    { label: 'Active phrases', value: stats?.activePhrases ?? 0, icon: <Mic className="w-5 h-5" />, color: '#ff6b6b' },
    { label: 'Custom SFX', value: stats?.sfx ?? 0, icon: <Music className="w-5 h-5" />, color: '#0ea5e9' },
  ];

  if (phase === 'loading') {
    return (
      <main className="min-h-[100dvh] bg-[#080d18] text-white flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-purple-400" />
      </main>
    );
  }

  if (phase === 'login') {
    return (
      <main className="min-h-[100dvh] bg-[#080d18] text-white flex items-center justify-center p-4 relative overflow-y-auto py-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-purple-600/15 blur-[120px] rounded-full pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="relative w-full max-w-sm bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-[28px] p-6 sm:p-8 shadow-2xl text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl shadow-purple-600/30 border border-purple-300/40">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="mt-4 text-xl font-black text-white">ADMIN ACCESS</h1>
          <p className="mt-1 text-[11px] text-slate-400 font-semibold">
            Only server-verified administrators can sign in here.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-3 text-left">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Username
              </label>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600"
              />
            </div>

            {error && (
              <p className="text-center text-[12px] font-bold text-red-400" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-black text-white text-sm tracking-wider shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {busy ? <Loader className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {busy ? 'Checking…' : 'SIGN IN TO DASHBOARD'}
            </button>
          </form>

          <Link href="/" className="mt-4 inline-block text-[11px] font-bold text-slate-500 hover:text-white transition-colors">
            ← Back to game
          </Link>
        </motion.div>
      </main>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'voice', label: 'Voice Library', icon: <Mic className="w-4 h-4" /> },
    { id: 'sfx', label: 'Sound Effects', icon: <Music className="w-4 h-4" /> },
    { id: 'players', label: 'Players', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <main className="h-[100dvh] bg-[#080d18] text-white overflow-y-auto overscroll-contain scroll-smooth">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="mx-auto max-w-6xl px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg shadow-lg border border-purple-300/40 shrink-0">
              🎲
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>
            <div className="min-w-0 leading-none">
              <h1 className="text-[15px] font-black leading-none truncate">LUDO MASTER</h1>
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">
                Admin Dashboard
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {admin && (
              <div className="flex items-center gap-2 pl-1">
                <CharacterAvatar
                  color={(admin.characterId as PlayerColor) || 'red'}
                  image={isImageAvatar(admin.avatar) ? admin.avatar : undefined}
                  className="w-8 h-8 hidden sm:flex"
                />
                <div className="hidden sm:block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    {admin.displayName || admin.username}
                  </span>
                  <span className="text-[8px] font-black px-2 py-0.5 rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-300">
                    ADMIN
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 text-[11px] font-black text-slate-300 transition-colors active:scale-95"
              aria-label="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="mx-auto max-w-6xl px-4 pb-2.5 flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shrink-0 active:scale-95 ${
                tab === t.id
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/40'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {statCards.map((s) => (
                    <div
                      key={s.label}
                      className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-600 rounded-2xl p-4 transition-colors"
                    >
                      <div
                        className="absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl opacity-30 pointer-events-none"
                        style={{ background: s.color }}
                      />
                      <div className="text-2xl mb-2" style={{ color: s.color }}>
                        {s.icon}
                      </div>
                      <div className="text-2xl font-black tabular-nums">{s.value}</div>
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-0.5">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent registrations */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-3">
                    Recent players
                  </h2>
                  {recent.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">No players yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {recent.map((u) => (
                        <div key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-slate-950/50 border border-slate-800">
                          <CharacterAvatar
                            color={(u.characterId as PlayerColor) || 'red'}
                            image={isImageAvatar(u.avatar) ? u.avatar : undefined}
                            className="w-9 h-9 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{u.displayName || u.username}</div>
                            <div className="text-[9px] text-slate-500">
                              @{u.username} · {u.wins} wins · Lv {u.level}
                            </div>
                          </div>
                          <span className="text-[9px] text-slate-600 shrink-0">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'voice' && <VoiceAdminPanel />}
            {tab === 'sfx' && <SfxAdminPanel />}

            {tab === 'players' && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      value={playerQuery}
                      onChange={(e) => setPlayerQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runPlayerSearch()}
                      placeholder="Search username / email…"
                      className="w-full py-2.5 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <button
                    onClick={runPlayerSearch}
                    className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-black"
                  >
                    Search
                  </button>
                </div>

                {playersBusy ? (
                  <div className="py-10 flex justify-center">
                    <Loader className="w-5 h-5 animate-spin text-purple-400" />
                  </div>
                ) : players.length === 0 ? (
                  <p className="py-8 text-center text-[11px] text-slate-500 italic">No players found.</p>
                ) : (
                  <div className="overflow-auto max-h-[58vh] rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                          <th className="py-2 pr-3">Player</th>
                          <th className="py-2 pr-3">Email</th>
                          <th className="py-2 pr-3 text-right">Wins</th>
                          <th className="py-2 pr-3 text-right">Games</th>
                          <th className="py-2 pr-3 text-right">XP</th>
                          <th className="py-2 text-right">Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((u) => (
                          <tr key={u.id} className="border-b border-slate-800/60 hover:bg-slate-950/40">
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <CharacterAvatar
                                  color={(u.characterId as PlayerColor) || 'red'}
                                  image={isImageAvatar(u.avatar) ? u.avatar : undefined}
                                  className="w-9 h-9 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-white truncate">{u.displayName || u.username}</div>
                                  <div className="text-[9px] text-slate-500">@{u.username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2 pr-3 text-slate-400">{u.email || '—'}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{u.wins}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{u.games}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-amber-300">{u.xp}</td>
                            <td className="py-2 text-right">
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                Lv {u.level}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
