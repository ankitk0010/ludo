import { PlayerColor, Player, GameState } from '@/game/engine/types';
import { GameAction } from '@/game/engine/reducer';

export interface RoomMember {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  isBot?: boolean;
  deviceId: string | null;
  avatarUrl: string | null;
}

export interface RoomState {
  id: string;
  code: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  maxPlayers: number;
  players: RoomMember[];
}

const DEVICE_KEY = 'ludo_device_id_v1';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

async function postJson<T>(url: string, body: unknown, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export async function apiCreateRoom(input: {
  code: string;
  hostName: string;
  characterId: PlayerColor;
  avatarUrl?: string;
  deviceId: string;
  /** Signed-in session token — lets the server attach the room to your real account. */
  token?: string | null;
}): Promise<{ room: RoomState }> {
  const { token, ...body } = input;
  return postJson('/api/rooms', body, token);
}

export async function apiJoinRoom(input: {
  code: string;
  name: string;
  characterId: PlayerColor;
  avatarUrl?: string;
  deviceId: string;
}): Promise<{ room: RoomState; player: string }> {
  return postJson('/api/rooms/join', input);
}

export async function apiFetchRoom(code: string): Promise<{ room: RoomState }> {
  const res = await fetch(`/api/rooms?code=${encodeURIComponent(code)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Room not found');
  return data;
}

export async function apiSetReady(input: {
  code: string;
  deviceId: string;
  ready: boolean;
}): Promise<{ room: RoomState }> {
  const res = await fetch('/api/rooms/ready', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to update readiness');
  return data;
}

export async function apiLeaveRoom(input: { code: string; deviceId: string }): Promise<void> {
  try {
    await postJson('/api/rooms/leave', input);
  } catch {
    /* best-effort */
  }
}

// ---- Online room match: authoritative game state ----

export async function apiRoomState(code: string): Promise<{
  code: string;
  status: string;
  state: GameState | null;
}> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/game`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to load game');
  return data;
}

export async function apiRoomStart(
  code: string,
  deviceId: string
): Promise<{ state: GameState; players: Player[] }> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, action: { start: true } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not start the game');
  return data;
}

export async function apiRoomAction(
  code: string,
  deviceId: string,
  action: GameAction
): Promise<{ state: GameState; players: Player[] }> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Action failed');
  return data;
}
