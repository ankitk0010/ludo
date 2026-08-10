import { GameState } from '@/game/engine/types';
import { RoomVoiceMessage } from './roomBus';

export interface RoomCacheEntry {
  id: string;
  status: string;
  state: GameState | null;
  voiceMessages: RoomVoiceMessage[];
  at: number;
}

const roomCache = new Map<string, RoomCacheEntry>();

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
}
