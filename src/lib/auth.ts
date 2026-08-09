import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { isImageAvatar } from '@/game/avatars';

export const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sessionExpiry(days: number = SESSION_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export interface AuthUserPayload {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string;
  avatarUrl: string | null;
  characterId: string;
  wins: number;
  games: number;
  xp: number;
  level: number;
  email: string | null;
}

export function toUserPayload(user: {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string;
  characterId: string;
  wins: number;
  games: number;
  xp: number;
  level: number;
  email?: string | null;
}): AuthUserPayload {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    avatarUrl: isImageAvatar(user.avatar) ? user.avatar : null,
    characterId: user.characterId,
    wins: user.wins,
    games: user.games,
    xp: user.xp,
    level: user.level,
    email: user.email ?? null,
  };
}