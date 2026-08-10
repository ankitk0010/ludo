import { GameState } from '@/game/engine/types';
import { RoomVoiceMessage, emitRoom } from './roomBus';
import { prisma } from './prisma';

export interface RoomCacheEntry {
  id: string;
  status: string;
  state: GameState | null;
  voiceMessages: RoomVoiceMessage[];
  at: number;
}

const roomCache = new Map<string, RoomCacheEntry>();
const roomPresence = new Map<string, Map<string, number>>(); // roomCode -> (deviceId -> lastSeenTs)

export function getCachedRoom(code: string, ttlMs = 4000): RoomCacheEntry | null {
  const cached = roomCache.get(code);
  if (cached && Date.now() - cached.at < ttlMs) return cached;
  return null;
}

export function setCachedRoom(code: string, entry: RoomCacheEntry): void {
  roomCache.set(code, entry);
}

export function invalidateRoomCache(code: string): void {
  roomCache.delete(code);
  roomPresence.delete(code);
}

/** Update heartbeat timestamp for a player device in a room */
export function touchPlayerPresence(code: string, deviceId: string): void {
  if (!code || !deviceId) return;
  let map = roomPresence.get(code);
  if (!map) {
    map = new Map();
    roomPresence.set(code, map);
  }
  map.set(deviceId, Date.now());
}

/**
 * Check if any player has gone silent (>12s without heartbeat/action)
 * and automatically handle offline status / last remaining player victory.
 */
export async function checkRoomPresenceAndDisconnects(code: string): Promise<RoomCacheEntry | null> {
  const entry = roomCache.get(code);
  if (!entry || entry.status !== 'PLAYING' || !entry.state || entry.state.winner) return entry ?? null;

  const map = roomPresence.get(code);
  if (!map) return entry;

  const now = Date.now();
  let modified = false;
  let state = { ...entry.state };

  const updatedPlayers = state.players.map((p) => {
    if (p.isBot || !p.connected) return p;
    // Check if player ID (deviceId) has been silent for >12 seconds
    const lastSeen = map.get(p.id) ?? now;
    if (now - lastSeen > 12000) {
      modified = true;
      return { ...p, connected: false };
    }
    return p;
  });

  if (!modified) return entry;

  state = { ...state, players: updatedPlayers };

  // Check remaining connected players
  const connectedPlayers = state.players.filter((p) => p.connected && !p.isBot);

  // If only 1 (or 0) connected human player remains -> LAST PLAYER WINS AUTOMATICALLY!
  if (connectedPlayers.length <= 1 && !state.winner) {
    const winnerPlayer = connectedPlayers[0] || state.players.find((p) => p.connected) || state.players[0];
    state = {
      ...state,
      status: 'finished',
      winner: winnerPlayer.color,
      logs: [
        ...state.logs,
        `🎉 ${winnerPlayer.name} HAS WON THE GAME! (Opponent disconnected) 🎉`,
      ],
    };

    entry.status = 'FINISHED';
    entry.state = state;
    entry.at = now;

    prisma.gameRoom.update({
      where: { id: entry.id },
      data: { status: 'FINISHED', state: state as unknown as object },
    }).catch(() => {});

    emitRoom(code, { type: 'state', status: 'FINISHED', state });
    return entry;
  }

  entry.state = state;
  entry.at = now;

  prisma.gameRoom.update({
    where: { id: entry.id },
    data: { state: state as unknown as object },
  }).catch(() => {});

  emitRoom(code, { type: 'state', status: 'PLAYING', state });
  return entry;
}
