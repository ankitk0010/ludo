import { PlayerColor, Player, GameState } from '@/game/engine/types';
import { GameAction } from '@/game/engine/reducer';
import type { RoomStreamEvent, RoomVoiceMessage } from '@/lib/roomBus';

export type { RoomStreamEvent, RoomVoiceMessage };

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

export interface RoomVoiceInput {
  phraseId?: string;
  text: string;
  language: string;
  icon?: string;
}

/** Subscribe to real-time room pushes (SSE). Returns an unsubscribe function. */
export function subscribeRoomStream(
  code: string,
  onEvent: (event: RoomStreamEvent) => void
): () => void {
  let source: EventSource | null = null;
  try {
    source = new EventSource(`/api/rooms/${encodeURIComponent(code)}/game/stream`);
    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as RoomStreamEvent;
        onEvent(event);
      } catch {
        /* ignore malformed frames */
      }
    };
  } catch {
    /* EventSource unsupported — the polling fallback still covers it */
  }
  return () => source?.close();
}

export async function apiRoomState(code: string, deviceId?: string): Promise<{
  code: string;
  status: string;
  state: GameState | null;
  voiceMessages?: RoomVoiceMessage[];
}> {
  const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/game${query}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to load game');
  return data;
}

export async function apiRoomVoice(
  code: string,
  deviceId: string,
  voice: RoomVoiceInput
): Promise<{ voiceMessages: RoomVoiceMessage[] }> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, voice }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Voice message failed');
  return data;
}

export async function apiSendLiveVoice(
  code: string,
  deviceId: string,
  audioBase64: string,
  mimeType = 'audio/webm'
): Promise<void> {
  await fetch(`/api/rooms/${encodeURIComponent(code)}/game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, liveVoice: { audioBase64, mimeType } }),
  }).catch(() => {});
}

export async function apiPingRoom(): Promise<number> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  await fetch('/api/rooms/ping', { method: 'HEAD', cache: 'no-store' }).catch(() => {});
  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return Math.max(2, Math.round(end - start));
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
