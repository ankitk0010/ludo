'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, LogIn, Loader, Dice6, ShieldCheck, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { PlayerColor } from '@/game/engine/types';
import { AvatarSelector } from '@/components/avatar/AvatarSelector';
import { PlayerProfile } from '@/game/profile';
import { apiSignup, apiLogin, apiForgotPassword, toProfile } from '@/lib/authClient';

type Tab = 'signup' | 'login';
type View = 'auth' | 'forgot';

interface AuthScreenProps {
  initial?: Partial<PlayerProfile>;
  onAuthenticated: (profile: PlayerProfile, token: string) => void;
}

/*
 * Login / Sign-up screen. On sign-up you pick a character avatar, then choose
 * a username + password and your account is stored in the (dockerized) Postgres
 * database. Returning players just log in with username + password. The login
 * tab also offers password recovery (SMTP email).
 */
export const AuthScreen: React.FC<AuthScreenProps> = ({ initial, onAuthenticated }) => {
  const [tab, setTab] = useState<Tab>('signup');
  const [view, setView] = useState<View>('auth');
  const [character, setCharacter] = useState<PlayerColor>(initial?.characterId || 'red');
  const [username, setUsername] = useState(initial?.username || '');
  const [displayName, setDisplayName] = useState(initial?.displayName || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const switchTab = (next: Tab) => {
    setTab(next);
    setView('auth');
    setError(null);
    setPassword('');
    setConfirm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === 'signup') {
      const clean = username.trim();
      if (clean.length < 2 || clean.length > 16) {
        setError('Username needs 2-16 characters');
        return;
      }
      if (!/^[\w.]+$/.test(clean)) {
        setError('Only letters, numbers, dots and underscores allowed');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match');
        return;
      }
    } else {
      if (!username.trim() || !password) {
        setError('Enter your username and password');
        return;
      }
    }

    setBusy(true);
    try {
      const res =
        tab === 'signup'
          ? await apiSignup({
              username: username.trim(),
              password,
              displayName: displayName.trim() || undefined,
              email: email.trim() || undefined,
              characterId: character,
            })
          : await apiLogin({ username: username.trim(), password });

      onAuthenticated(toProfile(res.user, initial as PlayerProfile), res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('Enter a valid email address');
      return;
    }
    setBusy(true);
    try {
      await apiForgotPassword(clean);
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative bg-slate-900/80 backdrop-blur-md border border-slate-700/70 rounded-[28px] p-5 sm:p-7 shadow-2xl overflow-hidden"
      >
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[320px] h-[160px] bg-purple-500/20 blur-[80px] rounded-full pointer-events-none" />

        {/* Heading */}
        <div className="relative text-center">
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [0, -6, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl shadow-purple-600/30 border border-purple-300/40 text-3xl"
          >
            {view === 'forgot' ? <Mail /> : '🎲'}
          </motion.div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
            {view === 'forgot'
              ? 'RESET PASSWORD'
              : tab === 'signup'
                ? 'CREATE YOUR PLAYER'
                : 'WELCOME BACK'}
          </h2>
          <p className="mt-1 text-xs text-slate-400 font-bold">
            {view === 'forgot'
              ? 'Enter your account email and we will send you a reset link.'
              : tab === 'signup'
                ? 'Pick a character — your gotis and avatar will wear this look.'
                : 'Log in to continue your adventure.'}
          </p>
        </div>

        {view === 'forgot' ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={forgotSent ? 'sent' : 'form'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {forgotSent ? (
                <div className="relative mt-6 text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-sm font-extrabold text-white">Reset link sent</p>
                  <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                    If an account exists for <span className="text-amber-300">{email.trim()}</span>, a
                    password-reset link is on its way. Check your inbox (and spam folder).
                  </p>
                  <button
                    onClick={() => {
                      setView('auth');
                      setForgotSent(false);
                      setEmail('');
                    }}
                    className="mt-2 w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider transition-colors"
                  >
                    Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="relative mt-5 space-y-3">
                  <div>
                    <label htmlFor="forgot-email" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Account email
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600 transition-colors"
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
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 font-black text-white text-base tracking-wider shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                  >
                    {busy ? <Loader className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                    {busy ? 'Sending…' : 'SEND RESET LINK'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setView('auth');
                      setError(null);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-slate-500 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                  </button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <>
            {/* Tabs */}
            <div className="relative mt-5 grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-950/70 border border-slate-800">
              {(['signup', 'login'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    tab === t ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'signup' ? 'Sign up' : 'Log in'}
                </button>
              ))}
            </div>

            {/* Character picker (only for sign-up) */}
            <AnimatePresence initial={false}>
              {tab === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative overflow-hidden"
                >
                  <div className="mt-5">
                    <div className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">
                      Choose your avatar
                    </div>
                    <AvatarSelector selected={character} onSelect={setCharacter} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="relative mt-5 space-y-3">
              <div>
                <label htmlFor="auth-username" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Username
                </label>
                <input
                  id="auth-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. LuckyFox"
                  maxLength={16}
                  autoComplete="username"
                  className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600 transition-colors"
                />
              </div>

              <AnimatePresence initial={false}>
                {tab === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="auth-display" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                          Display name <span className="text-slate-600 normal-case">(optional)</span>
                        </label>
                        <input
                          id="auth-display"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="What friends call you"
                          maxLength={20}
                          autoComplete="nickname"
                          className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600 transition-colors"
                        />
                      </div>
                      <div>
                        <label htmlFor="auth-email" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                          Email <span className="text-slate-600 normal-case">(for password recovery)</span>
                        </label>
                        <input
                          id="auth-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          maxLength={120}
                          autoComplete="email"
                          className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600 transition-colors"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label htmlFor="auth-password" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === 'signup' ? 'At least 6 characters' : 'Your password'}
                  maxLength={64}
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600 transition-colors"
                />
                {tab === 'login' && (
                  <div className="mt-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot');
                        setError(null);
                      }}
                      className="text-[10px] font-black uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              <AnimatePresence initial={false}>
                {tab === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div>
                      <label htmlFor="auth-confirm" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                        Confirm password
                      </label>
                      <input
                        id="auth-confirm"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat your password"
                        maxLength={64}
                        autoComplete="new-password"
                        className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600 transition-colors"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-[12px] font-bold text-red-400"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              <motion.button
                type="submit"
                disabled={busy}
                whileHover={busy ? {} : { scale: 1.02 }}
                whileTap={busy ? {} : { scale: 0.96 }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 font-black text-white text-base tracking-wider shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {busy ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : tab === 'signup' ? (
                  <Rocket className="w-5 h-5" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {busy ? 'Please wait…' : tab === 'signup' ? 'CREATE ACCOUNT' : 'LOG IN'}
              </motion.button>
            </form>

            <div className="relative mt-4 flex items-center justify-center gap-4 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1"><Dice6 className="w-3 h-3 text-amber-400" /> Save your progress</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Secure login</span>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default AuthScreen;