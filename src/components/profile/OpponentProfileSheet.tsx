'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  UserPlus,
  UserCheck,
  Share2,
  Check,
  Bot,
  Trophy,
  Zap,
  LogIn,
  Users,
  Link2,
} from 'lucide-react';
import { Player } from '@/game/engine/types';
import { gameTheme } from '@/theme/tokens';
import { getCharacter } from '@/game/characters';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { useAuthToken } from '@/hooks/useAuthToken';
import {
  apiGetFriends,
  apiAddFriend,
  apiRemoveFriend,
  apiLookupUser,
  FriendUser,
} from '@/lib/friendClient';

interface OpponentProfileSheetProps {
  open: boolean;
  player: Player | null;
  onClose: () => void;
  /** Full invite URL — shows the invite button when provided. */
  inviteLink?: string;
  roomCode?: string;
  /** The signed-in player's display name — used to disable adding yourself. */
  ownName?: string;
  /** Finished gotis for this player (used in-game). */
  homeCount?: number;
  /** True when this player is on the same device (pass & play) — not a network account. */
  localPlay?: boolean;
  /** Whether "Add Friend" should be offered (online room opponents). */
  friendable?: boolean;
}

/*
 * View-only profile sheet for another player. Behavior adapts to who they are:
 *  - AI bots        → "AI opponent" card, no friend action.
 *  - Same-device    → pass & play seat, no friend action, invite to play online.
 *  - Online / room  → looks up their real account, offers Add / Remove Friend.
 */
export const OpponentProfileSheet: React.FC<OpponentProfileSheetProps> = ({
  open,
  player,
  onClose,
  inviteLink,
  roomCode,
  ownName,
  homeCount = 0,
  localPlay = false,
  friendable = true,
}) => {
  const token = useAuthToken();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [realProfile, setRealProfile] = useState<FriendUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [friendError, setFriendError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !player) return;
    let live = true;
    const name = player.name.trim();

    if (token) {
      apiGetFriends(token)
        .then((f) => live && setFriends(f))
        .catch(() => live && setFriends([]));
    }
    if (!player.isBot && !localPlay && name) {
      apiLookupUser(name)
        .then((u) => live && setRealProfile(u ?? null))
        .catch(() => live && setRealProfile(null));
    }
    return () => {
      live = false;
    };
  }, [open, player, token, localPlay]);

  const isFriend = useMemo(() => {
    if (!player) return false;
    if (realProfile) return friends.some((f) => f.id === realProfile.id);
    const n = player.name.trim().toLowerCase();
    return friends.some(
      (f) => f.username?.trim().toLowerCase() === n || f.displayName?.trim().toLowerCase() === n
    );
  }, [friends, player, realProfile]);

  const isBot = !!player?.isBot;
  const isSelf = !!ownName && !!player && player.name === ownName;
  const displayName = useMemo(
    () =>
      (realProfile?.displayName || realProfile?.username || (player ? player.name.split(' (')[0] : '')) || 'Player',
    [player, realProfile]
  );
  const wins = realProfile?.wins ?? player?.wins ?? 0;
  const xp = realProfile?.xp ?? player?.xp ?? 0;

  const handleAdd = async () => {
    if (!player || !token) return;
    setBusy(true);
    setFriendError(null);
    try {
      await apiAddFriend(token, { username: player.name });
      setFriends(await apiGetFriends(token));
      const u = await apiLookupUser(player.name).catch(() => null);
      if (u) setRealProfile(u);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not add friend';
      setFriendError(
        msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not on')
          ? "This player isn't on Ludo yet — invite them to play!"
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!player || !token) return;
    setBusy(true);
    setFriendError(null);
    try {
      await apiRemoveFriend(token, { username: player.name });
      setFriends(await apiGetFriends(token));
    } catch (e) {
      setFriendError(e instanceof Error ? e.message : 'Could not remove friend');
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteLink) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Ludo Master — join my room',
          text: `Join my Ludo room${roomCode ? `: ${roomCode}` : ''}`,
          url: inviteLink,
        });
        return;
      }
    } catch {
      /* user cancelled */
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const charStyle = player ? gameTheme.players[player.color] : gameTheme.players.red;

  return (
    <AnimatePresence>
      {open && player && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-x-0 bottom-0 z-[110] mx-auto w-full sm:max-w-md rounded-t-[28px] bg-slate-900 border-t border-l border-r border-slate-700/60 p-5 shadow-2xl max-h-[86dvh] overflow-y-auto sm:rounded-3xl sm:bottom-4 sm:inset-x-4 sm:top-auto sm:mx-auto sm:border"
            role="dialog"
            aria-modal="true"
            aria-label={isBot ? 'Bot profile' : 'Player profile'}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-slate-700 mb-4 sm:hidden" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span className="text-xl">{isBot ? '🤖' : localPlay ? '🎮' : '👤'}</span>
                {isBot ? 'BOT PROFILE' : localPlay ? 'LOCAL PLAYER' : 'PLAYER PROFILE'}
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
                aria-label="Close profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Identity header */}
            <div
              className="relative flex items-center gap-3.5 p-4 rounded-2xl border overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${charStyle.primary}26 0%, rgba(15,23,42,0.9) 65%)`,
                borderColor: `${charStyle.primary}55`,
              }}
            >
              <div className="relative shrink-0">
                <CharacterAvatar
                  color={player.color}
                  glow
                  image={realProfile && realProfile.avatarUrl ? realProfile.avatarUrl : player.avatarUrl}
                  className="w-16 h-16"
                />
                {isBot && (
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-purple-300" />
                  </span>
                )}
                {isFriend && !isBot && (
                  <span
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center"
                    title="Friend"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-white" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-[15px] font-extrabold text-white leading-tight truncate">{displayName}</h4>
                  {isSelf && (
                    <span className="text-[8px] font-black text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                      YOU
                    </span>
                  )}
                  {isFriend && !isBot && (
                    <span className="text-[8px] font-black text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full shrink-0">
                      FRIEND
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ background: `${charStyle.primary}22`, color: charStyle.primary }}
                  >
                    {getCharacter(player.color).title}
                  </span>
                  {isBot ? (
                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                      <Bot className="w-3 h-3" /> AI Opponent
                    </span>
                  ) : localPlay ? (
                    <span className="text-[9px] font-bold text-amber-300 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Same device
                    </span>
                  ) : player.connected === false ? (
                    <span className="text-[9px] font-bold text-red-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Offline
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Online
                    </span>
                  )}
                  {!isBot && realProfile && (
                    <span className="text-[9px] font-bold text-slate-400">· Lv {realProfile.level}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <Trophy className="w-4 h-4 text-amber-400 mx-auto" />
                <div className="text-sm font-extrabold text-white mt-1">{wins}</div>
                <div className="text-[8px] font-black uppercase tracking-wide text-slate-500">Wins</div>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <Zap className="w-4 h-4 text-purple-400 mx-auto" />
                <div className="text-sm font-extrabold text-white mt-1">{xp}</div>
                <div className="text-[8px] font-black uppercase tracking-wide text-slate-500">XP</div>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <span className="text-base leading-none block">🏠</span>
                <div className="text-sm font-extrabold text-white mt-1">{homeCount}/4</div>
                <div className="text-[8px] font-black uppercase tracking-wide text-slate-500">Home</div>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <span
                  className={`w-3.5 h-3.5 rounded-full mx-auto ${
                    isBot ? 'bg-slate-500' : localPlay ? 'bg-amber-400' : player.connected === false ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'
                  }`}
                />
                <div className="text-sm font-extrabold text-white mt-1.5">
                  {isBot ? 'BOT' : localPlay ? 'LOCAL' : player.connected === false ? 'OFFLINE' : 'ONLINE'}
                </div>
                <div className="text-[8px] font-black uppercase tracking-wide text-slate-500">Status</div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 space-y-2">
              {isBot ? (
                <div className="px-3 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-purple-300" /> This is an AI opponent — the computer plays it.
                </div>
              ) : localPlay ? (
                <div className="px-3 py-3 rounded-xl bg-slate-950/60 border border-amber-500/25 text-center text-[11px] font-bold text-amber-300 flex items-center justify-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Local player on this device — invite them online to become friends.
                </div>
              ) : isSelf ? (
                <div className="px-3 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-[11px] font-bold text-slate-400">
                  🤍 This is your own profile.
                </div>
              ) : !token ? (
                <div className="px-3 py-3 rounded-xl bg-slate-950/60 border border-amber-500/30 text-center text-[11px] font-bold text-amber-300 flex items-center justify-center gap-1.5">
                  <LogIn className="w-3.5 h-3.5" /> Log in to add friends
                </div>
              ) : friendable ? (
                <>
                  <button
                    onClick={isFriend ? handleRemove : handleAdd}
                    disabled={busy}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm tracking-wider transition-all active:scale-95 disabled:opacity-60 ${
                      isFriend
                        ? 'bg-slate-800 text-rose-300 border border-rose-500/30 hover:bg-slate-700'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25'
                    }`}
                  >
                    {busy ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isFriend ? (
                      <>
                        <UserCheck className="w-4 h-4" /> REMOVE FRIEND
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" /> ADD FRIEND
                      </>
                    )}
                  </button>
                  {friendError && (
                    <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-center text-[11px] font-bold text-red-300 flex items-center justify-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" /> {friendError}
                    </div>
                  )}
                </>
              ) : (
                <div className="px-3 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-[11px] font-bold text-slate-400">
                  This player can&apos;t be added as a friend right now.
                </div>
              )}

              {inviteLink && (
                <button
                  onClick={handleInvite}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm tracking-wider transition-all active:scale-95 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4 text-amber-300" />}
                  {copied ? 'INVITE LINK COPIED!' : 'INVITE TO ROOM'}
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="mt-3 w-full py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 text-xs font-bold transition-colors"
            >
              CLOSE
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OpponentProfileSheet;