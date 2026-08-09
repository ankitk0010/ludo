'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, X, Layers } from 'lucide-react';
import { Player } from '@/game/engine/types';
import { gameTheme } from '@/theme/tokens';
import { soundEngine } from '@/components/sound/soundEngine';
import { VoicePhrase } from '@/lib/voiceTypes';
import {
  BUILTIN_PHRASES,
  fetchVoiceLibrary,
  playPhrase,
  preloadPhrases,
} from '@/game/voicePhrases';

interface VoiceBubble {
  id: number;
  text: string;
  emoji: string;
  by: string;
  color: string;
}

const RATE_WINDOW_MS = 8000;
const RATE_MAX = 10;

const randomOf = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const nowTs = () => Date.now();
const randomDelayMs = (from: number, to: number) => from + Math.random() * (to - from);
let idSeq = 1;

type LangFilter = 'all' | 'hi' | 'en';

/*
 * Preset voice reactions (system B). The player taps a short Hindi/English
 * phrase; a speech bubble pops up near their profile and the phrase is spoken
 * (TTS in the phrase's language, or the admin-uploaded audio clip). The list
 * is managed by admins through the Voice Library — the game only fetches it.
 */
export const VoiceChat: React.FC<{
  players: Player[];
  className?: string;
}> = ({ players, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [bubble, setBubble] = useState<VoiceBubble | null>(null);
  const [unread, setUnread] = useState(0);
  const [phrases, setPhrases] = useState<VoicePhrase[]>(BUILTIN_PHRASES);
  const [lang, setLang] = useState<LangFilter>('all');
  const searchesRef = useRef<number[]>([]);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(isOpen);

  const myColor = players.find((p) => !p.isBot)?.color ?? 'red';
  const myColorHex = gameTheme.players[myColor].primary;

  // Load the server-managed library (fall back to built-ins when offline).
  useEffect(() => {
    let live = true;
    fetchVoiceLibrary().then((lib) => {
      if (live) setPhrases(lib);
    });
    return () => {
      live = false;
    };
  }, []);

  // Preload the most-used audio clips (cached; no per-click Audio objects).
  useEffect(() => {
    if (phrases.length > 0) preloadPhrases(phrases);
  }, [phrases]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  const shown = useMemo(
    () =>
      phrases
        .filter((p) => p.isActive !== false && (lang === 'all' || p.language === lang))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [phrases, lang]
  );

  const isRateLimited = () => {
    const now = nowTs();
    const recent = searchesRef.current.filter((t) => now - t < RATE_WINDOW_MS);
    searchesRef.current = recent;
    return recent.length >= RATE_MAX;
  };

  const showBubble = (msg: VoiceBubble) => {
    setBubble(msg);
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => setBubble(null), 2400);
  };

  const react = (phrase: VoicePhrase) => {
    if (isRateLimited()) return;
    searchesRef.current = [...searchesRef.current, nowTs()];
    soundEngine.playClick();
    playPhrase(phrase);
    showBubble({
      id: idSeq++,
      text: phrase.text,
      emoji: phrase.icon || '🎙️',
      by: 'You',
      color: myColorHex,
    });

    // Bots occasionally reply with a quiet English line.
    const bots = players.filter((p) => p.isBot);
    const enReplies = phrases.filter((p) => p.isActive !== false && p.language === 'en');
    if (bots.length > 0 && enReplies.length > 0 && randomOf([true, false])) {
      const msg = randomOf(enReplies);
      const bot = randomOf(bots);
      setTimeout(() => {
        showBubble({
          id: idSeq++,
          text: msg.text,
          emoji: msg.icon || '💬',
          by: bot.name.split(' (')[0],
          color: gameTheme.players[bot.color]?.primary ?? '#8b5cf6',
        });
        if (!isOpenRef.current) setUnread((u) => u + 1);
      }, randomDelayMs(2200, 3600));
    }
  };

  return (
    <>
      {/* Docked trigger — the page places this in the bottom action bar */}
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) {
            setUnread(0);
            soundEngine.playClick();
          }
        }}
        aria-label={isOpen ? 'Close voice reactions' : 'Open voice reactions'}
        className={`relative w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform border border-purple-300/40 flex-shrink-0 ${className}`}
      >
        {isOpen ? <X className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        {unread > 0 && !isOpen && (
          <motion.span
            key={unread}
            initial={{ scale: 0.5 }}
            animate={{ scale: [1, 1.35, 1] }}
            transition={{ duration: 0.35 }}
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 bg-red-500 rounded-full text-[8px] font-black flex items-center justify-center border border-white/40 shadow"
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>

      {/* Transient speech bubble near the player's profile */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            className="fixed bottom-[8.75rem] z-[80] pointer-events-none flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl max-w-[250px] left-3 sm:right-4 sm:left-auto"
          >
            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.7 }} className="text-lg">
              {bubble.emoji}
            </motion.span>
            <div className="min-w-0">
              <div className="text-[9px] font-black" style={{ color: bubble.color }}>
                {bubble.by}
              </div>
              <div className="text-[11px] font-semibold text-white truncate">{bubble.text}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice reactions sheet — bottom sheet on mobile, popover on desktop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed z-[80] left-3 right-3 mx-auto max-w-sm sm:left-auto sm:right-4 sm:mx-0 sm:max-w-none sm:w-80 max-h-[min(360px,58dvh)] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden bottom-[8.25rem]"
          >
            {/* Header */}
            <div className="px-3 py-2.5 bg-gradient-to-r from-purple-600/25 to-indigo-600/15 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-purple-300" /> VOICE REACTIONS
                </span>
                <span className="text-[9px] text-slate-400 font-bold">Tap to speak 🔊</span>
              </div>

              {/* Language filter */}
              <div className="mt-2 flex items-center gap-1.5">
                {(
                  [
                    ['all', '🌐 All'],
                    ['hi', '🇮🇳 हिंदी'],
                    ['en', '🇬🇧 English'],
                  ] as [LangFilter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLang(key)}
                    className={`px-2 py-1 rounded-full text-[9px] font-black transition-colors ${lang === key
                        ? 'bg-purple-500/30 text-white border border-purple-400/50'
                        : 'bg-slate-800/70 text-slate-400 border border-transparent hover:text-white'
                      }`}
                  >
                    {label}
                  </button>
                ))}
                <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-slate-500">
                  <Layers className="w-2.5 h-2.5" /> {shown.length} phrases
                </span>
              </div>
            </div>

            {/* Phrase grid */}
            <div className="grid grid-cols-2 gap-1.5 p-2 overflow-y-auto">
              {shown.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => react(p)}
                  className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-[11px] font-semibold text-left transition-colors hover:scale-[1.02] active:scale-95"
                >
                  <span className="text-base leading-none shrink-0">{p.icon || '🎙️'}</span>
                  <span className="flex-1 truncate">{p.text}</span>
                  <span className="text-slate-500 text-[10px] shrink-0">🔊</span>
                </button>
              ))}
              {shown.length === 0 && (
                <div className="col-span-full py-3 text-center text-[10px] text-slate-500 italic">
                  No phrases in this language yet.
                </div>
              )}
            </div>

            <div className="px-3 pb-1.5 text-center text-[8px] font-bold text-slate-600">
              Quick reactions only — managed by the game admins.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceChat;