import { PlayerProfile } from '@/game/profile';

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string;
    avatarUrl: string | null;
    characterId: PlayerProfile['characterId'];
    wins: number;
    games: number;
    xp: number;
    level: number;
    email?: string | null;
  };
  token: string;
}

async function postJson(url: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as AuthResponse;
}

export async function apiSignup(input: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  characterId: PlayerProfile['characterId'];
}): Promise<AuthResponse> {
  return postJson('/api/auth/signup', input);
}

export async function apiLogin(input: { username: string; password: string }): Promise<AuthResponse> {
  return postJson('/api/auth/login', input);
}

export async function apiForgotPassword(email: string): Promise<void> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to send reset email');
}

export async function apiUpdateProfile(
  token: string,
  patch: { characterId?: PlayerProfile['characterId']; displayName?: string; avatar?: string }
): Promise<AuthResponse['user']> {
  const res = await fetch('/api/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to save profile');
  return data.user;
}

export async function apiLogout(token: string): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* best-effort */
  }
}

/** Map an AuthResponse user into the local PlayerProfile shape. */
export function toProfile(user: AuthResponse['user'], fallback?: PlayerProfile): PlayerProfile {
  return {
    username: user.username,
    displayName: user.displayName || fallback?.displayName || '',
    characterId: user.characterId || fallback?.characterId || 'red',
    avatarUrl: user.avatarUrl ?? fallback?.avatarUrl,
    email: user.email ?? fallback?.email,
    level: user.level ?? fallback?.level ?? 1,
    wins: user.wins ?? fallback?.wins ?? 0,
    games: user.games ?? fallback?.games ?? 0,
    xp: user.xp ?? fallback?.xp ?? 0,
  };
}