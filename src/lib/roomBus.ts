import type { GameState } from '@/game/engine/types';

export interface RoomVoiceMessage {
  id: string;
  byDeviceId: string;
  byName: string;
  byColor: string;
  phraseId: string;
  text: string;
  language: string;
  icon: string;
  at: number;
}

export type RoomStreamEvent =
  | { type: 'state'; status: string; state: GameState | null }
  | { type: 'voice'; voiceMessages: RoomVoiceMessage[] };

type Listener = (event: RoomStreamEvent) => void;

/*
 * In-memory per-room event bus used by the SSE stream endpoint
 * (/api/rooms/[code]/game/stream). The authoritative game route emits on every
 * mutation so subscribed clients get state + voice instantly instead of
 * waiting for the next poll tick.
 */
const rooms = new Map<string, Set<Listener>>();

export function subscribeRoom(code: string, listener: Listener): () => void {
  let set = rooms.get(code);
  if (!set) {
    set = new Set();
    rooms.set(code, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) rooms.delete(code);
  };
}

export function emitRoom(code: string, event: RoomStreamEvent): void {
  const set = rooms.get(code);
  if (!set) return;
  set.forEach((listener) => {
    try {
      listener(event);
    } catch {
      /* a broken listener must never break the broadcaster */
    }
  });
}
