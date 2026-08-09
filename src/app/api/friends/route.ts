import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toUserPayload } from '@/lib/auth';

export const runtime = 'nodejs';

function readBearer(request: Request): string | null {
  const auth = request.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

async function currentUser(request: Request) {
  const token = readBearer(request);
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

/** Resolve a friend target by id or by username / display name (case-insensitive). */
async function resolveTarget(body: { id?: string; username?: string }) {
  const id = typeof body.id === 'string' && body.id ? body.id.trim() : null;
  const username = typeof body.username === 'string' && body.username.trim() ? body.username.trim() : null;
  if (id) return prisma.user.findUnique({ where: { id } });
  if (username) {
    return prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { displayName: { equals: username, mode: 'insensitive' } },
        ],
      },
    });
  }
  return null;
}

async function friendsOf(userId: string) {
  const edges = await prisma.friend.findMany({
    where: { OR: [{ fromId: userId }, { toId: userId }] },
    include: { from: true, to: true },
  });
  return edges
    .map((e) => (e.fromId === userId ? e.to : e.from))
    .map((u) => ({ ...toUserPayload(u), isFriend: true }));
}

/** GET /api/friends — the signed-in user's friend list. */
export async function GET(request: Request) {
  try {
    const me = await currentUser(request);
    if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const friends = await friendsOf(me.id);
    return NextResponse.json({ friends });
  } catch (error) {
    console.error('List friends failed:', error);
    return NextResponse.json({ error: 'Failed to load friends' }, { status: 500 });
  }
}

/** POST /api/friends — add a friend ({ id } or { username }). */
export async function POST(request: Request) {
  try {
    const me = await currentUser(request);
    if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const target = await resolveTarget(body);
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    if (target.id === me.id) return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 });

    const existing = await prisma.friend.findFirst({
      where: { OR: [{ fromId: me.id, toId: target.id }, { fromId: target.id, toId: me.id }] },
    });
    if (existing) return NextResponse.json({ friend: toUserPayload(target), already: true });

    await prisma.friend.create({ data: { fromId: me.id, toId: target.id } });
    return NextResponse.json({ friend: toUserPayload(target), added: true });
  } catch (error) {
    console.error('Add friend failed:', error);
    return NextResponse.json({ error: 'Failed to add friend' }, { status: 500 });
  }
}

/** DELETE /api/friends — remove a friend ({ id } or { username }). */
export async function DELETE(request: Request) {
  try {
    const me = await currentUser(request);
    if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const target = await resolveTarget(body);
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    await prisma.friend.deleteMany({
      where: { OR: [{ fromId: me.id, toId: target.id }, { fromId: target.id, toId: me.id }] },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Remove friend failed:', error);
    return NextResponse.json({ error: 'Failed to remove friend' }, { status: 500 });
  }
}