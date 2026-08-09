'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { KeyRound, Loader, CheckCircle2 } from 'lucide-react';
import { saveProfile, saveAuthToken, loadProfile } from '@/game/profile';
import { toProfile } from '@/lib/authClient';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      const t = setTimeout(() => setError('This reset link is invalid or incomplete.'), 0);
      return () => clearTimeout(t);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('This reset link is invalid or incomplete.');
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

    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');

      const profile = toProfile(data.user, loadProfile());
      saveProfile(profile);
      saveAuthToken(data.token);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-purple-600/15 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative w-full max-w-sm bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-[28px] p-6 sm:p-8 shadow-2xl text-center"
      >
        {done ? (
          <>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 mb-4"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <h1 className="text-xl font-black text-white">Password updated</h1>
            <p className="mt-1 text-xs text-slate-400 font-semibold">
              You are signed in. Enjoy your next match!
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-5 w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-black text-white text-sm tracking-wider shadow-xl shadow-purple-600/30 transition-transform active:scale-95"
            >
              Back to Lobby
            </button>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl shadow-purple-600/30 border border-purple-300/40 mb-4">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-black text-white">Choose a new password</h1>
            <p className="mt-1 text-[11px] text-slate-400 font-semibold">
              Enter a new password for your Ludo Master account.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3 text-left">
              <div>
                <label htmlFor="reset-pass" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  New password
                </label>
                <input
                  id="reset-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  maxLength={64}
                  autoComplete="new-password"
                  className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600"
                />
              </div>
              <div>
                <label htmlFor="reset-confirm" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                  Confirm password
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  maxLength={64}
                  autoComplete="new-password"
                  className="w-full py-3 px-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 placeholder:text-slate-600"
                />
              </div>

              {error && <p className="text-center text-[12px] font-bold text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={busy || !token}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 font-black text-white text-sm tracking-wider shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {busy ? <Loader className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
                {busy ? 'Updating…' : 'UPDATE PASSWORD'}
              </button>
            </form>

            <button onClick={() => router.push('/')} className="mt-3 text-[11px] font-bold text-slate-500 hover:text-white transition-colors">
              ← Back to home
            </button>
          </>
        )}
      </motion.div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">
          Loading…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
