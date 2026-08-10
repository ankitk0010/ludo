'use client';

import React, { useEffect, useState } from 'react';
import { Upload, Trash2, Play, Music } from 'lucide-react';
import { refreshSfxOverrides } from '@/components/sound/soundEngine';

const TOKEN_KEY = 'ludo_auth_token_v1';

const SFX_KEYS: { key: string; name: string }[] = [
  { key: 'dice_roll', name: 'Dice roll (rattle)' },
  { key: 'dice_land', name: 'Dice land (thump)' },
  { key: 'launch', name: 'Token launch (step out)' },
  { key: 'token_move', name: 'Token move (hop)' },
  { key: 'capture', name: 'Capture / cut (impact)' },
  { key: 'reach_home', name: 'Gotis reach home (fanfare)' },
  { key: 'power_card', name: 'Power card used' },
  { key: 'victory', name: 'Victory jingle' },
];

interface SfxEntry {
  id?: string;
  key: string;
  name: string;
  audioUrl: string | null;
}

/*
 * Admin SFX library. Upload an audio clip (mp3/ogg/wav) for any game sound —
 * it replaces the built-in oscillator sound everywhere. Remove to reset.
 * Uploads are stored on disk; the database only keeps the URL.
 */
export const SfxAdminPanel: React.FC = () => {
  const [token] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  });
  const [entries, setEntries] = useState<SfxEntry[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = (): HeadersInit => ({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  async function load() {
    const res = await fetch('/api/sfx', { headers: headers() });
    const data = await res.json();
    const map = new Map(((data.sfx || []) as SfxEntry[]).map((s) => [s.key, s]));
    setEntries(
      SFX_KEYS.map((def) => {
        const entry = map.get(def.key);
        return { id: entry?.id || '', key: def.key, name: def.name, audioUrl: entry?.audioUrl || null };
      })
    );
  }

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const upload = async (key: string, file: File) => {
    if (!token) {
      setError('Sign in as admin first');
      return;
    }

    const MAX_SIZE = 2.5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum size limit is 2.5MB.`);
      return;
    }
    const validExts = ['mp3', 'wav', 'ogg', 'm4a', 'mp4', 'webm', 'aac'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!file.type.startsWith('audio/') && !validExts.includes(ext || '')) {
      setError(`Invalid file type "${file.name}". Please upload a valid audio file (MP3, WAV, OGG, M4A, WEBM).`);
      return;
    }

    setBusyKey(key);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/voice/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || 'Upload failed');

      const res = await fetch('/api/sfx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, name: key, audioUrl: upData.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      await load();
      void refreshSfxOverrides();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusyKey(null);
    }
  };

  const remove = async (key: string) => {
    if (!token) return;
    setBusyKey(key);
    try {
      await fetch(`/api/sfx/${key}`, { method: 'DELETE', headers: headers() });
      await load();
      void refreshSfxOverrides();
    } finally {
      setBusyKey(null);
    }
  };

  const preview = (url: string) => {
    try {
      const a = new Audio(url);
      a.currentTime = 0;
      void a.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  if (!token) {
    return (
      <div className="mt-6 bg-slate-900/60 border border-slate-700 rounded-2xl p-4">
        <div className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Music className="w-4 h-4 text-sky-400" /> Sound effects
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Sign in as admin above to manage game sounds.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <Music className="w-4 h-4 text-sky-400" /> Sound Effects Library
        </h2>
        <span className="text-[10px] font-bold text-slate-400">upload audio from your device</span>
      </div>

      {/* Upload Instructions & Requirements Banner */}
      <div className="mt-3 bg-sky-950/40 border border-sky-500/30 rounded-2xl p-3.5 text-xs text-sky-200">
        <div className="font-extrabold text-sky-300 flex items-center gap-1.5 mb-1">
          <span>🎵</span> SFX UPLOADS & RESTRICTIONS
        </div>
        <ul className="list-disc list-inside space-y-1 text-[11px] text-sky-200/90 font-medium">
          <li><strong>Allowed Formats:</strong> MP3, WAV, OGG, M4A, WEBM audio files.</li>
          <li><strong>Size Restriction:</strong> Maximum <strong>2.5MB</strong> per file.</li>
          <li><strong>Recommended Duration:</strong> 0.5s to 3s per game action.</li>
          <li><strong>Live Gameplay Integration:</strong> Uploaded SFX clips replace built-in sounds in live matches.</li>
        </ul>
      </div>

      {error && <div className="mt-3 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</div>}

      <div className="mt-3 space-y-1.5">
        {entries.map((e) => (
          <div
            key={e.key}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
              e.audioUrl ? 'bg-sky-500/5 border-sky-500/30' : 'bg-slate-900/60 border-slate-700/60'
            }`}
          >
            <span className="text-base shrink-0">{e.audioUrl ? '🔊' : '🔉'}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-white truncate">{e.name}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                {e.key} · {e.audioUrl ? 'custom audio' : 'built-in'}
              </div>
            </div>
            {e.audioUrl && (
              <button
                onClick={() => preview(e.audioUrl!)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center shrink-0"
                aria-label="Preview"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}
            <label
              className={`w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer shrink-0 ${busyKey === e.key ? 'opacity-60 pointer-events-none' : ''}`}
            >
              {busyKey === e.key ? (
                <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-sky-300" />
              )}
              <input
                type="file"
                accept="audio/mpeg,audio/ogg,audio/wav,audio/mp3"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) void upload(e.key, f);
                  ev.currentTarget.value = '';
                }}
              />
            </label>
            {e.audioUrl && (
              <button
                onClick={() => void remove(e.key)}
                className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center shrink-0"
                aria-label="Remove custom sound"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-[9px] text-slate-600 mt-2">
        Custom audio replaces the built-in sound everywhere. Delete the clip (🗑) to restore the built-in.
      </p>
    </div>
  );
};

export default SfxAdminPanel;