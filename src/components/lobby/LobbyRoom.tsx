'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, UserPlus, Play, Bot, Lock, Shapes, Share2, Eye, X, Crown, Sparkles, LogOut } from 'lucide-react';
import { Player, PlayerColor } from '@/game/engine/types';
import { AvatarSelector } from '@/components/avatar/AvatarSelector';
import { getCharacter } from '@/game/characters';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { registerServiceWorker, apiRegisterPushSubscription } from '@/lib/roomClient';

interface LobbyRoomProps {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  onAddBot?: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  characterId?: PlayerColor;
  onCharacterChange?: (color: PlayerColor) => void;
  /** Colors already claimed by other human players (locked in the picker). */
  takenColors?: PlayerColor[];
  localPlayerId?: string;
  /** Full invite URL — shows the share/invite button when provided. */
  inviteLink?: string;
  /** True when this is an online room (no bots allowed, show join hints). */
  roomMode?: boolean;
  /** Tap a filled slot to view that player's profile. */
  onViewProfile?: (player: Player) => void;
}

export const LobbyRoom: React.FC<LobbyRoomProps> = ({
  roomCode,
  players,
  isHost,
  onAddBot,
  onToggleReady,
  onStartGame,
  onLeaveRoom,
  characterId = 'red',
  onCharacterChange,
  takenColors = [],
  localPlayerId = 'p1',
  inviteLink,
  roomMode = false,
  onViewProfile,
}) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const pushSubRef = useRef<PushSubscription | null>(null);
  const myChar = getCharacter(characterId);

  // Register service worker + push subscription when the lobby opens in room mode
  useEffect(() => {
    if (!roomMode) return;
    let cancelled = false;
    registerServiceWorker().then((sub) => {
      if (cancelled || !sub) return;
      pushSubRef.current = sub;
      setNotifGranted(true);
      // Tell the server about this device's push endpoint
      const deviceId = typeof window !== 'undefined' ? (localStorage.getItem('ludo_device_id_v1') || '') : '';
      if (deviceId) void apiRegisterPushSubscription(deviceId, sub);
    });
    return () => { cancelled = true; };
  }, [roomMode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareInvite = async () => {
    const link = inviteLink || `${window.location.origin}/game?mode=room&code=${roomCode}&host=false`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Ludo Master — Join My Room', text: `Join my Ludo room: ${roomCode}`, url: link });
        return;
      }
    } catch {
      /* user cancelled */
      return;
    }
    await navigator.clipboard.writeText(link);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const colors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
  const allReady = players.length >= 2 && players.every((p) => p.ready || p.isBot);
  const readyCount = players.filter((p) => p.ready || p.isBot).length;
  const localPlayer = players.find((p) => p.id === localPlayerId);
  const localReady = localPlayer?.ready ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full max-w-lg mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5"
    >
      {/* Modern Lobby Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2.5 bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800 shadow-inner">
          <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">ROOM CODE</span>
          <span className="text-amber-400 font-black text-base tracking-widest">{roomCode}</span>
          <button
            onClick={handleCopyCode}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            aria-label="Copy room code"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>GAME LOBBY</span>
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            {roomMode
              ? `Waiting for players to join (${players.length}/4 seats occupied)`
              : 'Setup players & get ready for the match'}
          </p>
        </div>

        {/* Invite / Share button */}
        {inviteLink && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleShareInvite}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-white text-xs tracking-wider shadow-lg transition-all ${
              shared
                ? 'bg-emerald-600 shadow-emerald-600/30'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
            }`}
          >
            {shared ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {shared ? 'INVITE LINK COPIED TO CLIPBOARD!' : 'SHARE INVITE LINK TO FRIENDS'}
          </motion.button>
        )}
      </div>

      {/* Roster / Player Seats */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-400 px-1">
          <span>Players ({players.length}/4)</span>
          <span className="text-emerald-400">{readyCount} Ready</span>
        </div>

        {colors.map((color) => {
          const player = players.find((p) => p.color === color);
          const isSeatHost = player && isHost && player.id === localPlayerId;

          return (
            <motion.div
              key={color}
              whileHover={player && onViewProfile ? { scale: 1.01 } : {}}
              onClick={player && onViewProfile ? () => onViewProfile(player) : undefined}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                player
                  ? 'bg-slate-950/90 border-slate-800 cursor-pointer shadow-md'
                  : 'bg-slate-950/30 border-dashed border-slate-800/60'
              }`}
            >
              {player ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-11 h-11 rounded-full shrink-0">
                    <CharacterAvatar color={player.color} image={player.avatarUrl} className="w-11 h-11" />
                    {isSeatHost && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-black shadow">
                        <Crown className="w-2.5 h-2.5 fill-current" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white flex items-center gap-1.5 leading-tight">
                      <span className="truncate">{player.name}</span>
                      {player.id === localPlayerId && (
                        <span className="text-[8px] bg-purple-500/25 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-black shrink-0">
                          YOU
                        </span>
                      )}
                      {player.isBot && (
                        <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 shrink-0">
                          <Bot className="w-3 h-3" /> BOT
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] font-black uppercase mt-0.5 tracking-wider" style={{ color: color }}>
                      {color} seat
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-9 h-9 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-xs text-slate-400 font-bold">
                    +
                  </div>
                  {roomMode && inviteLink ? (
                    <button
                      onClick={handleShareInvite}
                      className="text-xs font-bold italic text-purple-300 hover:text-purple-200 transition-colors"
                    >
                      Tap invite to fill slot →
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-slate-500 italic">Empty Slot</span>
                  )}
                </div>
              )}

              <div className="shrink-0 flex items-center gap-2">
                {player ? (
                  <>
                    {onViewProfile && (
                      <span className="w-7 h-7 rounded-xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center transition-colors" title="View profile">
                        <Eye className="w-3.5 h-3.5 text-slate-300" />
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-black px-3 py-1 rounded-xl flex items-center gap-1.5 border ${
                        player.ready || player.isBot
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          player.ready || player.isBot ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                        }`}
                      />
                      {player.ready || player.isBot ? 'READY' : 'WAITING'}
                    </span>
                  </>
                ) : (
                  isHost &&
                  !roomMode &&
                  onAddBot && (
                    <button
                      onClick={onAddBot}
                      className="px-3 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-600/30 transition-colors flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add AI Bot
                    </button>
                  )
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Character Selector Section */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
            <Shapes className="w-4 h-4 text-purple-400" /> Choose Character
          </div>
          <span
            className="text-[9px] font-black px-2.5 py-0.5 rounded-full border"
            style={{ background: `${myChar.primary}20`, color: myChar.primary, borderColor: `${myChar.primary}50` }}
          >
            {myChar.title}
          </span>
        </div>

        <AvatarSelector
          selected={characterId}
          onSelect={onCharacterChange || (() => {})}
          disabledColors={takenColors}
        />
        {takenColors.length > 0 && (
          <p className="text-[9px] text-slate-500 font-bold flex items-center gap-1">
            <Lock className="w-3 h-3 text-red-400" />
            Taken colors are locked by other room members.
          </p>
        )}
      </div>

      {/* Inline Non-Sticky Action Controls Footer */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
        {isHost ? (
          <motion.button
            whileHover={allReady ? { scale: 1.02 } : {}}
            whileTap={allReady ? { scale: 0.97 } : {}}
            onClick={onStartGame}
            disabled={!allReady}
            className={`w-full py-4 rounded-2xl font-black text-white text-base tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
              allReady
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 cursor-pointer shadow-emerald-500/25'
                : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <Play className="w-5 h-5 fill-current" /> START GAME MATCH
          </motion.button>
        ) : (
          <>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onToggleReady}
              className={`w-full py-4 rounded-2xl font-black text-white text-base tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
                localReady
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-600/30'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-600/30'
              }`}
            >
              {localReady ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
              {localReady ? 'CANCEL READY' : 'GET READY FOR MATCH'}
            </motion.button>
            <p className="text-center text-[10px] font-bold text-slate-400">
              {localReady
                ? '✓ You are ready! Waiting for room host to start the game.'
                : 'Mark yourself ready so the host can start.'}
            </p>
          </>
        )}

        {isHost && !allReady && (
          <p className="text-center text-[10px] font-bold text-slate-400">
            {players.length < 2
              ? '⚠️ Waiting for at least 2 players to join before starting.'
              : `⚠️ All players must tap READY (${readyCount}/${players.length}) before game start.`}
          </p>
        )}

        <button
          type="button"
          onClick={onLeaveRoom}
          className="w-full py-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> Leave Room
        </button>
      </div>
    </motion.div>
  );
};

export default LobbyRoom;
