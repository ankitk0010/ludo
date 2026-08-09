'use client';

import React, { useState } from 'react';
import { Copy, Check, UserPlus, Play, Bot, Lock, Shapes, Share2, Eye, X } from 'lucide-react';
import { Player, PlayerColor } from '@/game/engine/types';
import { GameSettings } from '@/game/settings';
import { AvatarSelector } from '@/components/avatar/AvatarSelector';
import { getCharacter } from '@/game/characters';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';

interface LobbyRoomProps {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  onAddBot?: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
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
  const myChar = getCharacter(characterId);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareInvite = async () => {
    const link = inviteLink || `${window.location.origin}/game?mode=room&code=${roomCode}&host=false`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Ludo Master — join my room', text: `Join my Ludo room: ${roomCode}`, url: link });
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
    <div className="w-full max-w-lg mx-auto bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Lobby Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-slate-950 px-4 py-1.5 rounded-full border border-slate-800 text-xs font-bold text-slate-300">
          <span>ROOM CODE:</span>
          <span className="text-amber-400 font-extrabold text-sm tracking-wider">{roomCode}</span>
          <button onClick={handleCopyCode} className="text-slate-400 hover:text-white ml-1" aria-label="Copy room code">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <h2 className="text-2xl font-black text-white">GAME LOBBY</h2>
        <p className="text-xs text-slate-400">
          {roomMode
            ? `Waiting for players to join (${players.length}/4 seats)`
            : 'Waiting for players to join (2 to 4 players)'}
        </p>

        {/* Invite / share */}
        {inviteLink && (
          <button
            onClick={handleShareInvite}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-white text-sm tracking-wider shadow-lg transition-all active:scale-95 ${
              shared
                ? 'bg-emerald-600 shadow-emerald-600/30'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
            }`}
          >
            {shared ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
            {shared ? 'INVITE LINK COPIED!' : 'SHARE INVITE LINK'}
          </button>
        )}
      </div>

      {/* Player Slots */}
      <div className="space-y-3">
        {colors.map((color) => {
          const player = players.find((p) => p.color === color);

          return (
            <div
              key={color}
              onClick={player && onViewProfile ? () => onViewProfile(player) : undefined}
              title={player && onViewProfile ? 'View profile' : undefined}
              className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all ${
                player
                  ? 'bg-slate-950 border-slate-800 cursor-pointer hover:border-slate-600 active:scale-[0.99]'
                  : 'bg-slate-950/40 border-dashed border-slate-800/80'
              }`}
            >
              {player ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full shrink-0">
                    {player.avatarUrl ? (
                      <CharacterAvatar color={player.color} image={player.avatarUrl} className="w-11 h-11" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-xl shadow-md border-2 border-slate-700">
                        {player.avatar}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span className="truncate">{player.name}</span>
                      {player.id === localPlayerId && (
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-extrabold shrink-0">
                          YOU
                        </span>
                      )}
                      {player.isBot && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 shrink-0">
                          <Bot className="w-3 h-3" /> BOT
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-extrabold uppercase" style={{ color: color }}>
                      {color}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-slate-500">
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-xs">
                    +
                  </div>
                  {roomMode && inviteLink ? (
                    <button
                      onClick={handleShareInvite}
                      className="text-xs font-bold italic text-purple-300 hover:text-purple-200 transition-colors"
                    >
                      Tap invite to fill this slot →
                    </button>
                  ) : (
                    <span className="text-xs font-bold italic">Empty Slot</span>
                  )}
                </div>
              )}

              <div className="shrink-0 flex items-center gap-1.5">
                {player ? (
                  <>
                    {onViewProfile && (
                      <span className="w-7 h-7 rounded-full bg-slate-800/70 flex items-center justify-center" title="View profile">
                        <Eye className="w-3 h-3 text-slate-400" />
                      </span>
                    )}
                    <span
                      className={`text-xs font-black px-3 py-1 rounded-full ${
                        player.ready || player.isBot
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      }`}
                    >
                      {player.ready || player.isBot ? 'READY' : 'WAITING'}
                    </span>
                  </>
                ) : (
                  isHost &&
                  !roomMode &&
                  onAddBot && (
                    <button
                      onClick={onAddBot}
                      className="px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-600/40 transition-colors flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add AI Bot
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Your character — chosen BEFORE the game starts */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
            <Shapes className="w-4 h-4 text-purple-400" /> Your Character
          </div>
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{ background: `${myChar.primary}22`, color: myChar.primary }}
          >
            {myChar.title}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 font-semibold -mt-1">
          This can be changed anytime from your profile.
        </p>
        <AvatarSelector
          selected={characterId}
          onSelect={onCharacterChange || (() => {})}
          disabledColors={takenColors}
        />
        {takenColors.length > 0 && (
          <p className="text-[9px] text-slate-600 font-bold flex items-center gap-1">
            <Lock className="w-3 h-3 text-red-400" />
            Locked colors are already taken by another player.
          </p>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex flex-col gap-3 pt-2">
        {isHost ? (
          <button
            onClick={onStartGame}
            disabled={!allReady}
            className={`w-full py-4 rounded-2xl font-black text-white text-base tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
              allReady
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 cursor-pointer shadow-emerald-500/20 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Play className="w-5 h-5 fill-current" /> START GAME
          </button>
        ) : (
          <button
            onClick={onToggleReady}
            className={`w-full py-4 rounded-2xl font-black text-white text-base tracking-wider shadow-xl transition-transform active:scale-95 ${
              localReady
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/30'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/30'
            }`}
          >
            {localReady ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />} {localReady ? 'CANCEL' : 'GET READY'}
          </button>
        )}

        {isHost && !allReady && (
          <p className="text-center text-[10px] font-bold text-slate-500">
            {players.length < 2
              ? 'Wait for at least 2 players to join before starting.'
              : `Everyone must be READY (${readyCount}/${players.length}) before the game can start.`}
          </p>
        )}

        <button
          onClick={onLeaveRoom}
          className="w-full py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 text-xs font-bold transition-colors"
        >
          LEAVE ROOM
        </button>
      </div>
    </div>
  );
};

export default LobbyRoom;
