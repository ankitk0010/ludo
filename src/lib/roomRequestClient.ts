import { FriendUser } from '@/lib/friendClient';

export interface RoomRequestInfo {
  id: string;
  status: string;
  roomCode: string;
  roomStatus: string;
  createdAt: string;
  respondedAt: string | null;
  from: FriendUser;
  to: FriendUser;
}

function headers(token: string, json = true): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function apiGetRoomRequests(token: string): Promise<{
  incoming: RoomRequestInfo[];
  outgoing: RoomRequestInfo[];
}> {
  const res = await fetch('/api/room-requests', { headers: headers(token, false) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to load invites');
  return { incoming: data.incoming || [], outgoing: data.outgoing || [] };
}

export async function apiSendRoomRequest(
  token: string,
  input: { roomCode: string; username: string }
): Promise<{ request: RoomRequestInfo }> {
  const res = await fetch('/api/room-requests', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to send invite');
  return data;
}

export async function apiRespondRoomRequest(
  token: string,
  id: string,
  action: 'accept' | 'decline' | 'cancel'
): Promise<{ request: RoomRequestInfo }> {
  const res = await fetch(`/api/room-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to answer invite');
  return data;
}