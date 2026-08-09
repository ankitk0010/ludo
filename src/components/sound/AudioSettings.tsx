'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Volume2, Mic, VolumeX, Settings } from 'lucide-react';
import { soundEngine } from './soundEngine';

const STORAGE_KEY = 'ludo_audio_settings_v1';

interface AudioSettingsState {
  sfx: number;
  music: number;
  voice: number;
  muted: boolean;
}

const load = (): AudioSettingsState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sfx: typeof parsed.sfx === 'number' ? parsed.sfx : 1,
        music: typeof parsed.music === 'number' ? parsed.music : 1,
        voice: typeof parsed.voice === 'number' ? parsed.voice : 1,
        muted: !!parsed.muted,
      };
    }
  } catch {
    /* ignore */
  }
  return { sfx: 1, music: 1, voice: 1, muted: false };
};

export const AudioSettings: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AudioSettingsState>(load);

  useEffect(() => {
    soundEngine.setSfxVolume(settings.muted ? 0 : settings.sfx);
  }, [settings.sfx, settings.muted]);

  useEffect(() => {
    soundEngine.setMusicVolume(settings.music);
  }, [settings.music]);

  const update = (next: AudioSettingsState) => {
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white transition-colors"
        aria-label="Audio settings"
      >
        {settings.muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Settings className="w-3.5 h-3.5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="absolute right-0 top-9 z-50 w-60 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl space-y-2"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Audio</span>
              <button
                onClick={() => update({ ...settings, muted: !settings.muted })}
                className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  settings.muted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {settings.muted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                {settings.muted ? 'MUTED' : 'LIVE'}
              </button>
            </div>

            <Row icon={<Music className="w-3 h-3" />} label="Music" color="#a78bfa" value={settings.music} onChange={(v) => update({ ...settings, music: v })} />
            <Row icon={<Volume2 className="w-3 h-3" />} label="SFX" color="#34d399" value={settings.sfx} onChange={(v) => update({ ...settings, sfx: v })} />
            <Row icon={<Mic className="w-3 h-3" />} label="Voice" color="#60a5fa" value={settings.voice} onChange={(v) => update({ ...settings, voice: v })} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Row = ({
  icon,
  label,
  color,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  value: number;
  onChange: (v: number) => void;
}) => (
  <div className="flex items-center gap-2 py-1">
    <span style={{ color }} className="w-3 flex-shrink-0">
      {icon}
    </span>
    <span className="w-10 text-[9px] font-black uppercase text-slate-400">{label}</span>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="flex-1 h-1.5 accent-purple-500 cursor-pointer"
    />
    <span className="text-[9px] font-bold tabular-nums text-slate-400 w-7 text-right">{Math.round(value * 100)}%</span>
  </div>
);