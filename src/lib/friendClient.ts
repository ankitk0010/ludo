export interface FriendUser {
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
  email?: string | null;
  isFriend?: boolean;
}

type FriendTarget = { username: string } | { id: string };

function headers(token: string, json = true): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function apiGetFriends(token: string): Promise<FriendUser[]> {
  const res = await fetch('/api/friends', { headers: headers(token, false) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to load friends');
  return data.friends || [];
}

/** Fetch a player's public account profile by name (null when they have none). */
export async function apiLookupUser(username: string): Promise<FriendUser | null> {
  const res = await fetch(`/api/users?username=${encodeURIComponent(username)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data.user ?? null;
}

export async function apiAddFriend(
  token: string,
  target: FriendTarget
): Promise<{ friend?: FriendUser; already?: boolean; added?: boolean }> {
  const res = await fetch('/api/friends', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(target),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to add friend');
  return data;
}

export async function apiRemoveFriend(token: string, target: FriendTarget): Promise<void> {
  const res = await fetch('/api/friends', {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify(target),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to remove friend');
}