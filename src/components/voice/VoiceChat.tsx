'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Smile, Volume2, Sparkles } from 'lucide-react';
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

interface ChatLogItem {
  id: string;
  text: string;
  icon: string;
  byName: string;
  byColor: string;
  timestamp: string;
  isSelf: boolean;
}

const EMOJI_REACTIONS = ['😂', '👍', '🔥', '👏', '🏆', '😭', '🎯', '💣', '⚡', '🎲', '🎉', '👑'];
const RATE_WINDOW_MS = 6000;
const RATE_MAX = 10;

const randomOf = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const nowTs = () => Date.now();
const randomDelayMs = (from: number, to: number) => from + Math.random() * (to - from);
const formatTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
let idSeq = 1;

type ChatTab = 'chat' | 'phrases' | 'emojis';
type LangFilter = 'all' | 'hi' | 'en';

/*
 * In-Game Real-Time Chat & Reaction Drawer.
 * Supports:
 *  - Custom text messages with live chat log feed
 *  - 1-tap quick emoji reactions
 *  - Admin-managed Hindi & English quick voice lines
 *  - Floating speech bubbles next to players
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
  const [activeTab, setActiveTab] = useState<ChatTab>('chat');
  const [bubble, setBubble] = useState<VoiceBubble | null>(null);
  const [unread, setUnread] = useState(0);
  const [phrases, setPhrases] = useState<VoicePhrase[]>(BUILTIN_PHRASES);
  const [lang, setLang] = useState<LangFilter>('all');
  const [customText, setCustomText] = useState('');
  const [chatLog, setChatLog] = useState<ChatLogItem[]>([]);
  const searchesRef = useRef<number[]>([]);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(isOpen);
  const chatLogEndRef = useRef<HTMLDivElement | null>(null);

  const myColor = players.find((p) => !p.isBot)?.color ?? 'red';
  const myColorHex = gameTheme.players[myColor].primary;

  // Load server-managed phrases
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

  // Auto scroll chat feed to bottom
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      chatLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatLog, isOpen, activeTab]);

  const shownPhrases = useMemo(
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

  const appendToChatLog = (item: ChatLogItem) => {
    setChatLog((prev) => [...prev.slice(-30), item]);
  };

  // Surface incoming room messages as bubbles & add to chat feed
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

      const senderName = msg.byName.split(' (')[0];
      const colorHex = gameTheme.players[msg.byColor as PlayerColor]?.primary ?? '#8b5cf6';

      showBubble({
        id: idSeq++,
        text: msg.text,
        emoji: msg.icon || '💬',
        by: senderName,
        color: colorHex,
      });

      appendToChatLog({
        id: `inc-${Date.now()}-${Math.random()}`,
        text: msg.text,
        icon: msg.icon || '💬',
        byName: senderName,
        byColor: colorHex,
        timestamp: formatTime(),
        isSelf: false,
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

    appendToChatLog({
      id: `self-${Date.now()}`,
      text,
      icon: '💬',
      byName: 'You',
      byColor: myColorHex,
      timestamp: formatTime(),
      isSelf: true,
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

  const sendEmojiReaction = (emoji: string) => {
    if (isRateLimited()) return;
    searchesRef.current = [...searchesRef.current, nowTs()];
    soundEngine.playReaction();

    showBubble({
      id: idSeq++,
      text: emoji,
      emoji,
      by: 'You',
      color: myColorHex,
    });

    appendToChatLog({
      id: `self-${Date.now()}`,
      text: emoji,
      icon: emoji,
      byName: 'You',
      byColor: myColorHex,
      timestamp: formatTime(),
      isSelf: true,
    });

    if (roomMode && roomCode && deviceId) {
      apiRoomVoice(roomCode, deviceId, {
        phraseId: 'emoji-reaction',
        text: emoji,
        language: 'en',
        icon: emoji,
      }).catch(() => {});
    }
  };

  const reactPhrase = (phrase: VoicePhrase) => {
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

    appendToChatLog({
      id: `self-${Date.now()}`,
      text: phrase.text,
      icon: phrase.icon || '🎙️',
      byName: 'You',
      byColor: myColorHex,
      timestamp: formatTime(),
      isSelf: true,
    });

    if (roomMode && roomCode && deviceId) {
      apiRoomVoice(roomCode, deviceId, {
        phraseId: phrase.id,
        text: phrase.text,
        language: phrase.language,
        icon: phrase.icon,
      }).catch(() => {});
    }

    // AI Bots occasionally reply
    const bots = players.filter((p) => p.isBot);
    const enReplies = phrases.filter((p) => p.isActive !== false && p.language === 'en');
    if (bots.length > 0 && enReplies.length > 0 && randomOf([true, false])) {
      const msg = randomOf(enReplies);
      const bot = randomOf(bots);
      const botName = bot.name.split(' (')[0];
      const botColor = gameTheme.players[bot.color]?.primary ?? '#8b5cf6';
      setTimeout(() => {
        showBubble({
          id: idSeq++,
          text: msg.text,
          emoji: msg.icon || '💬',
          by: botName,
          color: botColor,
        });
        appendToChatLog({
          id: `bot-${Date.now()}`,
          text: msg.text,
          icon: msg.icon || '💬',
          byName: botName,
          byColor: botColor,
          timestamp: formatTime(),
          isSelf: false,
        });
        if (!isOpenRef.current) setUnread((u) => u + 1);
      }, randomDelayMs(1800, 3200));
    }
  };

  return (
    <>
      {/* Docked trigger button */}
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
        aria-label={isOpen ? 'Close in-game chat' : 'Open in-game chat'}
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

      {/* Floating speech bubble */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            className="fixed bottom-[8.75rem] z-[80] pointer-events-none flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl max-w-[260px] left-3 sm:right-4 sm:left-auto"
          >
            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.7 }} className="text-xl">
              {bubble.emoji}
            </motion.span>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-black truncate" style={{ color: bubble.color }}>
                {bubble.by}
              </div>
              <div className="text-[11px] font-bold text-white truncate">{bubble.text}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed z-[80] left-3 right-3 mx-auto max-w-sm sm:left-auto sm:right-4 sm:mx-0 sm:max-w-none sm:w-88 h-[min(420px,65dvh)] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden bottom-[8.25rem]"
          >
            {/* Header with Navigation Tabs */}
            <div className="px-3 pt-3 pb-2 bg-gradient-to-r from-purple-600/25 to-indigo-600/15 border-b border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-300" /> IN-GAME CHAT
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'chat'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" /> Messages
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('emojis')}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'emojis'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smile className="w-3 h-3" /> Emojis
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('phrases')}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'phrases'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3" /> Quick Voice
                </button>
              </div>
            </div>

            {/* TAB CONTENT: Chat Feed */}
            {activeTab === 'chat' && (
              <div className="flex-1 p-3 overflow-y-auto space-y-2 flex flex-col">
                {chatLog.length === 0 ? (
                  <div className="my-auto text-center py-6 text-slate-500 text-xs font-semibold space-y-1">
                    <div className="text-2xl">💬</div>
                    <div>No chat messages yet.</div>
                    <div className="text-[10px] text-slate-600">Type a message below to start chatting!</div>
                  </div>
                ) : (
                  chatLog.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-col max-w-[85%] ${
                        item.isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-0.5 px-1">
                        <span className="text-[9px] font-black" style={{ color: item.byColor }}>
                          {item.byName}
                        </span>
                        <span className="text-[8px] text-slate-500">{item.timestamp}</span>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-2xl text-xs font-semibold break-words ${
                          item.isSelf
                            ? 'bg-purple-600 text-white rounded-br-none shadow-md'
                            : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                        }`}
                      >
                        {item.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatLogEndRef} />
              </div>
            )}

            {/* TAB CONTENT: Emoji Grid */}
            {activeTab === 'emojis' && (
              <div className="flex-1 p-3 overflow-y-auto">
                <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Tap to react instantly</div>
                <div className="grid grid-cols-4 gap-2">
                  {EMOJI_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => sendEmojiReaction(emoji)}
                      className="py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-2xl transition-transform active:scale-90 flex items-center justify-center border border-slate-700/60"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Quick Voice Phrases */}
            {activeTab === 'phrases' && (
              <div className="flex-1 p-2 overflow-y-auto space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1">
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
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black transition-colors ${
                          lang === key
                            ? 'bg-purple-500/30 text-white border border-purple-400/50'
                            : 'bg-slate-800/70 text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {shownPhrases.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => reactPhrase(p)}
                      className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white text-[11px] font-semibold text-left transition-colors hover:scale-[1.02] active:scale-95"
                    >
                      <span className="text-base leading-none shrink-0">{p.icon || '🎙️'}</span>
                      <span className="flex-1 truncate">{p.text}</span>
                      <Volume2 className="w-3 h-3 text-slate-500 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Text Chat Form — always present at bottom */}
            <form onSubmit={sendCustomChat} className="p-2 border-t border-slate-800 bg-slate-950/90 flex items-center gap-1.5">
              <input
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type custom chat message…"
                maxLength={80}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
              />
              <button
                type="submit"
                disabled={!customText.trim()}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black text-xs flex items-center gap-1 transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VoiceChat;