import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RoomRequestStatus } from '@prisma/client';
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

type Serialized = {
  id: string;
  status: string;
  roomCode: string;
  roomStatus: string;
  createdAt: Date;
  respondedAt: Date | null;
  from: ReturnType<typeof toUserPayload>;
  to: ReturnType<typeof toUserPayload>;
};

function serialize(r: {
  id: string;
  status: string;
  createdAt: Date;
  respondedAt: Date | null;
  from: Parameters<typeof toUserPayload>[0];
  to: Parameters<typeof toUserPayload>[0];
  room: { code: string; status: string };
}): Serialized {
  return {
    id: r.id,
    status: r.status,
    roomCode: r.room.code,
    roomStatus: r.room.status,
    createdAt: r.createdAt,
    respondedAt: r.respondedAt,
    from: toUserPayload(r.from),
    to: toUserPayload(r.to),
  };
}

/** GET /api/room-requests — the signed-in user's incoming + outgoing invites. */
export async function GET(request: Request) {
  try {
    const me = await currentUser(request);
    if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const [incoming, outgoing] = await Promise.all([
      prisma.roomRequest.findMany({
        where: { toId: me.id, status: { in: [RoomRequestStatus.PENDING, RoomRequestStatus.ACCEPTED] } },
        orderBy: { createdAt: 'desc' },
        include: { from: true, to: true, room: true },
      }),
      prisma.roomRequest.findMany({
        where: { fromId: me.id, status: { in: [RoomRequestStatus.PENDING, RoomRequestStatus.ACCEPTED] } },
        orderBy: { createdAt: 'desc' },
        include: { from: true, to: true, room: true },
      }),
    ]);

    return NextResponse.json({
      incoming: incoming.map(serialize),
      outgoing: outgoing.map(serialize),
    });
  } catch (error) {
    console.error('List room requests failed:', error);
    return NextResponse.json({ error: 'Failed to load invites' }, { status: 500 });
  }
}

/** POST /api/room-requests — invite a friend to join your room. Body: { roomCode, username }. */
export async function POST(request: Request) {
  try {
    const me = await currentUser(request);
    if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const roomCode = typeof body.roomCode === 'string' ? body.roomCode.trim().toUpperCase() : '';
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!roomCode || !username) {
      return NextResponse.json({ error: 'roomCode and username are required' }, { status: 400 });
    }

    const room = await prisma.gameRoom.findUnique({
      where: { code: roomCode },
      include: { players: true },
    });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if (room.status !== 'WAITING') {
      return NextResponse.json({ error: 'This room has already started' }, { status: 409 });
    }

    const target = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { displayName: { equals: username, mode: 'insensitive' } },
        ],
      },
    });
    if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    if (target.id === me.id) return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
    if (room.players.some((p) => p.userId === target.id)) {
      return NextResponse.json({ error: 'That player is already in the room' }, { status: 409 });
    }

    const pending = await prisma.roomRequest.findFirst({
      where: { roomId: room.id, toId: target.id, status: RoomRequestStatus.PENDING },
    });
    if (pending) return NextResponse.json({ error: 'Invite already sent' }, { status: 409 });

    const req = await prisma.roomRequest.create({
      data: { roomId: room.id, fromId: me.id, toId: target.id },
      include: { from: true, to: true, room: true },
    });
    return NextResponse.json({ request: serialize(req) }, { status: 201 });
  } catch (error) {
    console.error('Send room request failed:', error);
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
  }
}