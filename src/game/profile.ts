import { PlayerColor } from '@/game/engine/types';

export interface PlayerProfile {
  username: string;
  displayName: string;
  characterId: PlayerColor;
  /** Optional custom avatar image (data URL or URL) shown instead of the emoji. */
  avatarUrl?: string;
  /** Optional account email (used for password recovery). */
  email?: string;
  level: number;
  wins: number;
  games: number;
  xp: number;
}

const STORAGE_KEY = 'ludo_profile_v1';
const TOKEN_KEY = 'ludo_auth_token_v1';

export const DEFAULT_PROFILE: PlayerProfile = {
  username: '',
  displayName: '',
  characterId: 'red',
  level: 1,
  wins: 0,
  games: 0,
  xp: 0,
};

export function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch {
    /* ignore corrupt profile */
  }
  return DEFAULT_PROFILE;
}

export function saveProfile(profile: PlayerProfile) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export function hasProfile(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return Boolean(parsed.username);
  } catch {
    return false;
  }
}

// ---- Session token (login/signup) ----
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function saveAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAuthSession() {
  clearToken();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function clearToken() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Effective display name shown in game UI. */
export function profileName(profile: PlayerProfile): string {
  return profile.displayName || profile.username || 'Player';
}
