import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isImageAvatar } from '@/game/avatars';

export const runtime = 'nodejs';

const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'];
/** Cap stored avatar payloads (data-URIs) — generous enough for uploaded photos. */
const MAX_AVATAR_LENGTH = 3_500_000;

async function roomWithPlayers(code: string) {
  const room = await prisma.gameRoom.findUnique({
    where: { code: code.toUpperCase() },
    include: { players: true, host: true },
  });
  if (!room) return null;
  const players = room.players
    .slice()
    .sort((a, b) => COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color));
  return { ...room, players };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (code) {
      const room = await roomWithPlayers(code);
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }
      return NextResponse.json({ room });
    }

    const rooms = await prisma.gameRoom.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { players: true },
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json({ error: 'Database connection offline or error' }, { status: 500 });
  }
}

/**
 * POST /api/rooms — create a room (host player).
 * Body: { code?, hostName, characterId, avatarUrl?, deviceId }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const hostName = String(body.hostName || 'Host Player').slice(0, 24);
    const characterId = COLOR_ORDER.includes(body.characterId) ? body.characterId : 'red';
    const deviceId = body.deviceId ? String(body.deviceId).slice(0, 64) : null;
    const avatarUrl = isImageAvatar(body.avatarUrl) ? String(body.avatarUrl).slice(0, MAX_AVATAR_LENGTH) : null;

    const roomCode = body.code || Math.random().toString(36).substring(2, 8).toUpperCase();

    const existing = await prisma.gameRoom.findUnique({ where: { code: roomCode.toUpperCase() } });
    if (existing) {
      return NextResponse.json({ error: 'Room code already in use' }, { status: 409 });
    }

    // Create or find a default user for host (keeps leaderboard updated).
    const user = await prisma.user.upsert({
      where: { username: hostName.toLowerCase() },
      update: {},
      create: { username: hostName.toLowerCase(), avatar: '🦊', characterId },
    });

    const room = await prisma.gameRoom.create({
      data: {
        code: roomCode.toUpperCase(),
        hostId: user.id,
        players: {
          create: {
            userId: user.id,
            name: hostName,
            color: characterId,
            ready: true,
            deviceId,
            avatarUrl,
          },
        },
      },
    });

    const withPlayers = await roomWithPlayers(room.code);
    return NextResponse.json({ room: withPlayers });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}
