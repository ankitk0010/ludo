'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Layers } from 'lucide-react';
import { Player, PlayerColor } from '@/game/engine/types';
import { gameTheme } from '@/theme/tokens';
import { soundEngine } from '@/components/sound/soundEngine';
import { VoicePhrase } from '@/lib/voiceTypes';
import {
  BUILTIN_PHRASES,
  fetchVoiceLibrary,
  playPhrase,
  preloadPhrases,
} from '@/game/voicePhrases';
import { apiRoomVoice, RoomVoiceMessage } from '@/lib/roomClient';

interface VoiceBubble {
  id: number;
  text: string;
  emoji: string;
  by: string;
  color: string;
}

const RATE_WINDOW_MS = 6000;
const RATE_MAX = 10;

const randomOf = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const nowTs = () => Date.now();
const randomDelayMs = (from: number, to: number) => from + Math.random() * (to - from);
let idSeq = 1;

type LangFilter = 'all' | 'hi' | 'en';

/*
 * In-game Text Chat & Quick Reaction System.
 * Ultra-fast, zero-overhead text and quick voice lines.
 * Players can type custom chat messages OR tap quick Hindi/English voice lines.
 * Custom text and voice lines appear as speech bubbles next to players in real time!
 */
export const VoiceChat: React.FC<{
  players: Player[];
  className?: string;
  /** Online room relay: send taps to the room and show incoming messages. */
  roomMode?: boolean;
  roomCode?: string;
  deviceId?: string;
  /** Incoming room voice messages to surface as bubbles (already de-duplicated). */
  incoming?: RoomVoiceMessage[];
  /** Called once the incoming messages have been displayed. */
  onIncomingHandled?: () => void;
}> = ({ players, className = '', roomMode = false, roomCode, deviceId, incoming = [], onIncomingHandled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [bubble, setBubble] = useState<VoiceBubble | null>(null);
  const [unread, setUnread] = useState(0);
  const [phrases, setPhrases] = useState<VoicePhrase[]>(BUILTIN_PHRASES);
  const [lang, setLang] = useState<LangFilter>('all');
  const [customText, setCustomText] = useState('');
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

  // Preload commonly used audio clips
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
    bubbleTimerRef.current = setTimeout(() => setBubble(null), 3000);
  };

  // Surface incoming room messages as bubbles, speak them, and bump unread.
  useEffect(() => {
    if (!incoming.length) return;
    incoming.forEach((msg) => {
      if (msg.byDeviceId === deviceId) return;
      const phrase = phrases.find((p) => p.id === msg.phraseId);
      if (phrase) {
        playPhrase(phrase);
      } else {
        soundEngine.playReaction();
      }
      showBubble({
        id: idSeq++,
        text: msg.text,
        emoji: msg.icon || '💬',
        by: msg.byName.split(' (')[0],
        color: gameTheme.players[msg.byColor as PlayerColor]?.primary ?? '#8b5cf6',
      });
      if (!isOpenRef.current) setUnread((u) => u + 1);
    });
    onIncomingHandled?.();
  }, [incoming, phrases, deviceId, onIncomingHandled]);

  const sendCustomChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = customText.trim();
    if (!text || isRateLimited()) return;

    searchesRef.current = [...searchesRef.current, nowTs()];
    soundEngine.playReaction();
    showBubble({
      id: idSeq++,
      text,
      emoji: '💬',
      by: 'You',
      color: myColorHex,
    });

    if (roomMode && roomCode && deviceId) {
      apiRoomVoice(roomCode, deviceId, {
        phraseId: 'custom-text',
        text,
        language: 'en',
        icon: '💬',
      }).catch(() => {});
    }

    setCustomText('');
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

    if (roomMode && roomCode && deviceId) {
      apiRoomVoice(roomCode, deviceId, {
        phraseId: phrase.id,
        text: phrase.text,
        language: phrase.language,
        icon: phrase.icon,
      }).catch(() => {});
    }

    // Bots occasionally reply with a quiet English line
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
      }, randomDelayMs(2000, 3500));
    }
  };

  return (
    <>
      {/* Trigger Button — docked in action bar */}
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
        aria-label={isOpen ? 'Close chat' : 'Open in-game chat'}
        className={`relative w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform border border-purple-300/40 flex-shrink-0 ${className}`}
      >
        {isOpen ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
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

      {/* Speech bubble */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            className="fixed bottom-[8.75rem] z-[80] pointer-events-none flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl max-w-[260px] left-3 sm:right-4 sm:left-auto"
          >
            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.7 }} className="text-lg">
              {bubble.emoji}
            </motion.span>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-black truncate" style={{ color: bubble.color }}>
                {bubble.by}
              </div>
              <div className="text-[11px] font-semibold text-white truncate">{bubble.text}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat & Voice Reaction Sheet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed z-[80] left-3 right-3 mx-auto max-w-sm sm:left-auto sm:right-4 sm:mx-0 sm:max-w-none sm:w-84 max-h-[min(400px,62dvh)] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden bottom-[8.25rem]"
          >
            {/* Header */}
            <div className="px-3 py-2.5 bg-gradient-to-r from-purple-600/25 to-indigo-600/15 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-300" /> IN-GAME CHAT & REACTIONS
                </span>
                <span className="text-[9px] text-slate-400 font-bold">Live Text & Voice 💬</span>
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
                    className={`px-2 py-1 rounded-full text-[9px] font-black transition-colors ${
                      lang === key
                        ? 'bg-purple-500/30 text-white border border-purple-400/50'
                        : 'bg-slate-800/70 text-slate-400 border border-transparent hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <span className="ml-auto flex items-center gap-1 text-[8px] font-bold text-slate-500">
                  <Layers className="w-2.5 h-2.5" /> {shown.length} quick lines
                </span>
              </div>
            </div>

            {/* Quick reaction grid */}
            <div className="grid grid-cols-2 gap-1.5 p-2 overflow-y-auto max-h-[220px]">
              {shown.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => react(p)}
                  className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-[11px] font-semibold text-left transition-colors hover:scale-[1.02] active:scale-95"
                >
                  <span className="text-base leading-none shrink-0">{p.icon || '🎙️'}</span>
                  <span className="flex-1 truncate">{p.text}</span>
                </button>
              ))}
            </div>

            {/* Custom text chat form */}
            <form onSubmit={sendCustomChat} className="p-2 border-t border-slate-800 bg-slate-950/80 flex items-center gap-1.5">
              <input
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type custom chat message…"
                maxLength={80}
                className="flex-1 py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
              />
              <button
                type="submit"
                disabled={!customText.trim()}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 transition-all shrink-0"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceChat;