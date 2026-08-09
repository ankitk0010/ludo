'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Play, Save, ArrowUp, ArrowDown, Upload, LogIn } from 'lucide-react';
import { VoicePhrase, VOICE_CATEGORIES } from '@/lib/voiceTypes';
import { playPhrase } from '@/game/voicePhrases';

const TOKEN_KEY = 'ludo_auth_token_v1';

interface FormState {
  text: string;
  language: string;
  category: string;
  icon: string;
  characterId: string;
  sortOrder: number;
  audioUrl: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  text: '',
  language: 'hi',
  category: 'REACTION',
  icon: '🎙️',
  characterId: '',
  sortOrder: 0,
  audioUrl: '',
  isActive: true,
};

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/*
 * Admin voice library manager. All mutations are validated again on the
 * server (only authorized admin usernames may add/edit/delete/toggle/upload).
 */
export const VoiceAdminPanel: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [phrases, setPhrases] = useState<VoicePhrase[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/voice?all=1', { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load library');
        return;
      }
      setPhrases(data.phrases || []);
      setError(null);
    } catch {
      setError('Voice library unreachable (database offline?).');
    }
  }, [headers]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const auth = async (): Promise<string | null> => {
    if (token) return token;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: (document.getElementById('admin-user') as HTMLInputElement)?.value || 'admin',
          password: (document.getElementById('admin-pass') as HTMLInputElement)?.value || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return null;
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      return data.token as string;
    } catch {
      setError('Login service unreachable');
      return null;
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const t = token || (await auth());
    if (!t) return null;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/voice/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Upload failed');
      return null;
    }
    return data.url as string;
  };

  const submit = async () => {
    const t = token || (await auth());
    if (!t) return;
    if (!form.text.trim()) {
      setError('Phrase text is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        text: form.text.trim(),
        language: form.language,
        category: form.category,
        icon: form.icon || '🎙️',
        characterId: form.characterId || null,
        sortOrder: form.sortOrder,
        audioUrl: form.audioUrl || null,
        isActive: form.isActive,
      };
      const res = editingId
        ? await fetch(`/api/voice/${editingId}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
        : await fetch('/api/voice', { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Save failed');
        return;
      }
      setEditingId(null);
      setForm(EMPTY);
      await load();
    } catch {
      setError('Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    const t = token || (await auth());
    if (!t) return;
    await fetch(`/api/voice/${id}`, { method: 'DELETE', headers });
    await load();
  };

  const toggle = async (p: VoicePhrase) => {
    const t = token || (await auth());
    if (!t) return;
    await fetch(`/api/voice/${p.id}`, { method: 'PATCH', headers, body: JSON.stringify({ isActive: !p.isActive }) });
    await load();
  };

  const edit = (p: VoicePhrase) => {
    setEditingId(p.id);
    setForm({
      text: p.text,
      language: p.language,
      category: p.category,
      icon: p.icon || '🎙️',
      characterId: p.characterId || '',
      sortOrder: p.sortOrder,
      audioUrl: p.audioUrl || '',
      isActive: p.isActive,
    });
  };

  const move = async (p: VoicePhrase, dir: -1 | 1) => {
    const t = token || (await auth());
    if (!t) return;
    const sorted = [...phrases].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((x) => x.id === p.id);
    const other = sorted[idx + dir];
    if (!other) return;
    await Promise.all([
      fetch(`/api/voice/${p.id}`, { method: 'PATCH', headers, body: JSON.stringify({ sortOrder: other.sortOrder }) }),
      fetch(`/api/voice/${other.id}`, { method: 'PATCH', headers, body: JSON.stringify({ sortOrder: p.sortOrder }) }),
    ]);
    await load();
  };

  const sortText = () => phrases.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-10 bg-slate-900/80 border border-slate-700 rounded-3xl p-6 shadow-2xl">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <LogIn className="w-4 h-4 text-purple-400" /> Admin sign in
        </h2>
        <p className="text-[11px] text-slate-400 mt-1">Only server-verified admins can manage the voice library.</p>
        <div className="mt-4 space-y-2">
          <input id="admin-user" placeholder="Username" className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm" />
          <input id="admin-pass" type="password" placeholder="Password" className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm" />
          <button onClick={auth} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-black text-sm">
            Sign in
          </button>
        </div>
        {error && <div className="text-[11px] text-red-400 font-bold mt-3">{error}</div>}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-white">🎙️ Voice Library</h1>
        <span className="text-[10px] font-bold text-slate-400">{sortText().length} phrases</span>
      </div>
      {error && (
        <div className="mt-2 text-[11px] text-red-400 font-bold bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</div>
      )}

      {/* Editor */}
      <div className="mt-4 bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-300">
          {editingId ? '✏️ Edit phrase' : '🆕 Add phrase'}
        </div>
        <input
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          placeholder="Phrase text (e.g. बहुत बढ़िया!)"
          className="w-full py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            className="py-2 px-2 rounded-xl bg-slate-950 border border-slate-700 text-xs"
          >
            <option value="hi">हिंदी (hi)</option>
            <option value="en">English (en)</option>
          </select>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="py-2 px-2 rounded-xl bg-slate-950 border border-slate-700 text-xs"
          >
            {VOICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            placeholder="Emoji"
            className="py-2 px-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-center"
          />
          <input
            value={form.characterId}
            onChange={(e) => setForm({ ...form, characterId: e.target.value })}
            placeholder="Character (all)"
            className="py-2 px-2 rounded-xl bg-slate-950 border border-slate-700 text-xs"
          />
          <input
            value={form.sortOrder}
            type="number"
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
            placeholder="Order"
            className="py-2 px-2 rounded-xl bg-slate-950 border border-slate-700 text-xs"
          />
        </div>

        {/* Audio */}
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-black uppercase tracking-wider shrink-0 ${form.audioUrl ? 'text-emerald-400' : 'text-slate-500'}`}
          >
            {form.audioUrl ? '✔ Audio' : 'TTS·' }
          </span>
          <input
            value={form.audioUrl}
            onChange={(e) => setForm({ ...form, audioUrl: e.target.value })}
            placeholder="Audio URL (optional)"
            className="flex-1 min-w-0 py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs"
          />
          <label className="shrink-0 w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-slate-300" />
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f).then((url) => url && setForm((s) => ({ ...s, audioUrl: url })));
              }}
            />
          </label>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="accent-purple-500"
            />
            Enabled
          </label>
          <div className="flex gap-2">
            {editingId && (
              <button onClick={() => { setEditingId(null); setForm(EMPTY); }} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-black">
                Cancel
              </button>
            )}
            <button
              onClick={submit}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center gap-1.5 disabled:opacity-60"
            >
              {busy ? 'Saving…' : <Save className="w-3.5 h-3.5" />} {editingId ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Phrase list */}
      <div className="mt-4 space-y-1.5">
        {sortText().map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
              p.isActive ? 'bg-slate-900/70 border-slate-700/60' : 'bg-slate-950/60 border-slate-800 opacity-60'
            }`}
          >
            <span className="text-lg shrink-0">{p.icon || '🎙️'}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-white truncate">{p.text}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                {p.language === 'hi' ? '🇮🇳 हिंदी' : '🇬🇧 EN'} · {p.category} · #{p.sortOrder}
              </div>
            </div>
            <button
              onClick={() => playPhrase(p)}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center shrink-0"
              aria-label="Preview"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            </button>
            <button onClick={() => move(p, -1)} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center shrink-0" aria-label="Move up">
              <ArrowUp className="w-3 h-3 text-slate-300" />
            </button>
            <button onClick={() => move(p, 1)} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center shrink-0" aria-label="Move down">
              <ArrowDown className="w-3 h-3 text-slate-300" />
            </button>
            <button
              onClick={() => toggle(p)}
              className={`text-[8px] font-black px-1.5 py-1 rounded-full border shrink-0 ${
                p.isActive
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
            >
              {p.isActive ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => edit(p)} className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center shrink-0" aria-label="Edit">
              <span className="text-[11px]">✏️</span>
            </button>
            <button onClick={() => del(p.id)} className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center shrink-0" aria-label="Delete">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        ))}
        {phrases.length === 0 && (
          <div className="py-8 text-center text-[11px] text-slate-500 italic">
            No phrases yet — add your first one above.
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceAdminPanel;