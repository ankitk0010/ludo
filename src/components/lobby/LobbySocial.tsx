'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Check, X, Bell, Send, LogIn, Loader, UserCheck } from 'lucide-react';
import { PlayerProfile, profileName } from '@/game/profile';
import { useAuthToken } from '@/hooks/useAuthToken';
import { PlayerColor } from '@/game/engine/types';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { AuthModal } from '@/components/auth/AuthModal';
import { apiGetFriends, FriendUser } from '@/lib/friendClient';
import {
  apiGetRoomRequests,
  apiSendRoomRequest,
  apiRespondRoomRequest,
  RoomRequestInfo,
} from '@/lib/roomRequestClient';
import { apiJoinRoom } from '@/lib/roomClient';

function isAuthError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e || '');
  return /not authenticated|session expired|unauthorized|invalid session/i.test(msg);
}

interface LobbySocialProps {
  /** The room players can be invited to. */
  roomCode?: string;
  deviceId: string;
  profile: PlayerProfile;
  /** Names of players already sitting in the room (invites are hidden for them). */
  roomPlayerNames?: string[];
  /** 'full' — friend list + invite inbox panel (game lobby). 'notify' — floating inbox card (home). */
  variant?: 'full' | 'notify';
  className?: string;
}

/*
 * Social layer: shows your friends in the lobby with a one-tap "invite to this
 * room", and an invite inbox where you can accept (auto-joins the room) or
 * decline requests your friends sent you.
 */
export const LobbySocial: React.FC<LobbySocialProps> = ({
  roomCode = '',
  deviceId,
  profile,
  roomPlayerNames = [],
  variant = 'full',
  className = '',
}) => {
  const router = useRouter();
  const token = useAuthToken();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<RoomRequestInfo[]>([]);
  const [outgoing, setOutgoing] = useState<RoomRequestInfo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [f, rr] = await Promise.all([apiGetFriends(token), apiGetRoomRequests(token)]);
      setFriends(f);
      setIncoming(rr.incoming);
      setOutgoing(rr.outgoing);
      setNeedsAuth(false);
    } catch (e) {
      if (isAuthError(e)) setNeedsAuth(true);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let live = true;
    const onFail = (e: unknown) => {
      if (isAuthError(e)) setNeedsAuth(true);
    };
    apiGetFriends(token)
      .then((f) => {
        if (!live) return;
        setFriends(f);
        setNeedsAuth(false);
      })
      .catch(onFail);
    apiGetRoomRequests(token)
      .then((rr) => {
        if (!live) return;
        setIncoming(rr.incoming);
        setOutgoing(rr.outgoing);
        setNeedsAuth(false);
      })
      .catch(onFail);
    const id = setInterval(() => {
      apiGetFriends(token)
        .then((f) => live && setFriends(f))
        .catch(onFail);
      apiGetRoomRequests(token)
        .then((rr) => {
          if (!live) return;
          setIncoming(rr.incoming);
          setOutgoing(rr.outgoing);
        })
        .catch(onFail);
    }, 4000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [token]);

  const pendingIncoming = incoming.filter((r) => r.status === 'PENDING');
  const pendingOutgoing = outgoing.filter((r) => r.status === 'PENDING');
  const sentIds = useMemo(() => new Set(pendingOutgoing.map((r) => r.to.id)), [pendingOutgoing]);
  const inRoomNames = useMemo(() => new Set(roomPlayerNames.map((n) => n.trim().toLowerCase())), [roomPlayerNames]);
  const myName = profileName(profile).trim().toLowerCase();

  const sendInvite = async (friend: FriendUser) => {
    if (!token) return;
    const targetIdentifier = (friend.username || friend.displayName || friend.id || '').trim();
    if (!targetIdentifier) return;
    setBusyId(friend.id);
    setError(null);
    try {
      await apiSendRoomRequest(token, { roomCode, username: targetIdentifier });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send invite');
    } finally {
      setBusyId(null);
    }
  };

  const respond = async (req: RoomRequestInfo, action: 'accept' | 'decline' | 'cancel') => {
    if (!token) return;
    setBusyId(req.id);
    setError(null);
    try {
      await apiRespondRoomRequest(token, req.id, action);
      if (action === 'accept') {
        await apiJoinRoom({
          code: req.roomCode,
          name: profileName(profile),
          characterId: profile.characterId,
          avatarUrl: profile.avatarUrl,
          deviceId,
        });
        router.push(`/game?mode=room&code=${encodeURIComponent(req.roomCode)}&host=false`);
        return;
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not ${action} invite`);
    } finally {
      setBusyId(null);
    }
  };

  if (!token || (variant === 'full' && needsAuth)) {
    if (variant === 'notify') return null;
    return (
      <>
        <div className={`bg-slate-900/70 border border-slate-800 rounded-2xl p-4 text-center space-y-3 ${className}`}>
          <div className="text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1.5">
            <LogIn className="w-3.5 h-3.5" />
            {token ? 'Session expired — log in to invite friends' : 'Log in to invite friends to your room'}
          </div>
          <button
            onClick={() => setShowAuth(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
          >
            Log in / Sign up
          </button>
        </div>
        <AuthModal
          open={showAuth}
          onClose={() => setShowAuth(false)}
          initial={profile}
          onAuthenticated={() => setNeedsAuth(false)}
        />
      </>
    );
  }

  if (variant === 'notify') {
    if (needsAuth) {
      return (
        <>
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            className="fixed z-[90] right-3 top-3"
          >
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-amber-500/40 bg-slate-900/95 backdrop-blur-md shadow-xl text-[10px] font-black text-amber-300"
            >
              <LogIn className="w-3.5 h-3.5" /> Session expired — Log in
            </button>
          </motion.div>
          <AuthModal
            open={showAuth}
            onClose={() => setShowAuth(false)}
            initial={profile}
            onAuthenticated={() => setNeedsAuth(false)}
          />
        </>
      );
    }
    return (
      <>
        <AnimatePresence>
        {pendingIncoming.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            className="fixed z-[90] right-3 top-3 max-w-[min(calc(100vw-24px),340px)]"
          >
            <div className="rounded-2xl border border-purple-500/30 bg-slate-900/95 backdrop-blur-md shadow-2xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Bell className="w-3 h-3" /> Room invites ({pendingIncoming.length})
                </span>
              </div>
              <div className="space-y-2">
                {pendingIncoming.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5 bg-slate-950/80 rounded-xl border border-slate-800 p-2">
                    <CharacterAvatar
                      color={(r.from.characterId || 'red') as PlayerColor}
                      image={r.from.avatarUrl || undefined}
                      className="w-9 h-9 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-extrabold text-white">
                        {r.from.displayName || r.from.username}
                      </div>
                      <div className="text-[9px] font-bold text-amber-400 truncate">
                        invites you to room {r.roomCode}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => respond(r, 'accept')}
                        disabled={busyId !== null}
                        className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-50"
                        aria-label="Accept and join room"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => respond(r, 'decline')}
                        disabled={busyId !== null}
                        className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center justify-center disabled:opacity-50"
                        aria-label="Decline invite"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        <AuthModal
          open={showAuth}
          onClose={() => setShowAuth(false)}
          initial={profile}
          onAuthenticated={() => setNeedsAuth(false)}
        />
      </>
    );
  }

  const friendsToShow = friends.filter((f) => {
    const fn = (f.displayName || f.username || '').trim().toLowerCase();
    return fn !== myName && !inRoomNames.has(fn);
  });

  return (
    <div className={`bg-slate-900/80 border-2 border-slate-800 rounded-3xl p-5 space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-black uppercase tracking-wider text-purple-300">Friends</span>
        <span className="ml-auto text-[9px] font-bold text-slate-500">tap to invite to room {roomCode}</span>
      </div>

      {/* Friend list */}
      {friendsToShow.length === 0 ? (
        <p className="text-[11px] font-semibold text-slate-500 text-center py-2">
          {friends.length === 0
            ? 'No friends yet — add friends from a player’s profile.'
            : 'All your friends are already in this room.'}
        </p>
      ) : (
        <div className="space-y-2">
          {friendsToShow.map((f) => (
            <div key={f.id} className="flex items-center gap-2.5 bg-slate-950/80 rounded-xl border border-slate-800 p-2">
              <CharacterAvatar
                color={(f.characterId || 'red') as PlayerColor}
                image={f.avatarUrl || undefined}
                className="w-10 h-10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-extrabold text-white">{f.displayName || f.username}</div>
                <div className="text-[9px] font-bold text-slate-500">
                  Lv {f.level} · {f.wins} wins
                </div>
              </div>
              {sentIds.has(f.id) ? (
                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/15 px-2 py-1 rounded-full flex items-center gap-1 shrink-0">
                  <Send className="w-3 h-3" /> SENT
                </span>
              ) : (
                <button
                  onClick={() => sendInvite(f)}
                  disabled={busyId !== null}
                  className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[10px] font-black flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {busyId === f.id ? (
                    <Loader className="w-3 h-3 animate-spin" />
                  ) : (
                    <UserPlus className="w-3 h-3" />
                  )}
                  INVITE
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite inbox */}
      <div className="pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-black uppercase tracking-wider text-amber-300">Room invites</span>
          {pendingIncoming.length > 0 && (
            <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
              {pendingIncoming.length}
            </span>
          )}
        </div>

        {pendingIncoming.length === 0 && pendingOutgoing.length === 0 ? (
          <p className="text-[11px] font-semibold text-slate-500 text-center py-2">No invites yet.</p>
        ) : (
          <div className="space-y-2">
            {pendingIncoming.map((r) => (
              <div key={r.id} className="flex items-center gap-2 bg-slate-950/80 rounded-xl border border-amber-500/20 p-2.5">
                <CharacterAvatar
                  color={(r.from.characterId || 'red') as PlayerColor}
                  image={r.from.avatarUrl || undefined}
                  className="w-9 h-9 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-extrabold text-white">
                    {r.from.displayName || r.from.username}
                  </div>
                  <div className="text-[9px] font-bold text-amber-400 truncate">wants you to join room {r.roomCode}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => respond(r, 'accept')}
                    disabled={busyId !== null}
                    className="px-2.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-[9px] font-black text-white flex items-center gap-1 disabled:opacity-50"
                  >
                    {busyId === r.id ? <Loader className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                    JOIN
                  </button>
                  <button
                    onClick={() => respond(r, 'decline')}
                    disabled={busyId !== null}
                    className="px-2.5 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-[9px] font-black text-slate-300 flex items-center gap-1 disabled:opacity-50"
                  >
                    <X className="w-3 h-3" /> NO
                  </button>
                </div>
              </div>
            ))}
            {pendingOutgoing.map((r) => (
              <div key={r.id} className="flex items-center gap-2 bg-slate-950/60 rounded-xl border border-slate-800 p-2.5 opacity-80">
                <CharacterAvatar
                  color={(r.to.characterId || 'red') as PlayerColor}
                  image={r.to.avatarUrl || undefined}
                  className="w-9 h-9 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-extrabold text-white">
                    {r.to.displayName || r.to.username}
                  </div>
                  <div className="text-[9px] font-bold text-slate-500 truncate">invited to room {r.roomCode}</div>
                </div>
                <button
                  onClick={() => respond(r, 'cancel')}
                  disabled={busyId !== null}
                  className="px-2.5 py-1.5 rounded-full bg-slate-700 hover:bg-slate-600 text-[9px] font-black text-slate-300 disabled:opacity-50 shrink-0"
                >
                  <X className="w-3 h-3" /> CANCEL
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-[10px] font-bold text-red-300 text-center">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default LobbySocial;