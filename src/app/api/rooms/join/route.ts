import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isImageAvatar } from '@/game/avatars';

export const runtime = 'nodejs';

const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'];
/** Cap stored avatar payloads (data-URIs) — generous enough for uploaded photos. */
const MAX_AVATAR_LENGTH = 3_500_000;

function orderPlayers(players: { color: string }[]) {
  return players.slice().sort((a, b) => COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color));
}

/**
 * POST /api/rooms/join — join a waiting room with your profile.
 * Body: { code, name, characterId, avatarUrl?, deviceId }
 * - Same deviceId rejoins/updates instead of duplicating.
 * - A free color is chosen when the requested one is taken.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim().toUpperCase();
    const name = String(body.name || 'Player').slice(0, 24);
    const requestedColor = COLOR_ORDER.includes(body.characterId) ? body.characterId : null;
    const deviceId = body.deviceId ? String(body.deviceId).slice(0, 64) : null;
    const avatarUrl = isImageAvatar(body.avatarUrl) ? String(body.avatarUrl).slice(0, MAX_AVATAR_LENGTH) : null;

    if (!code) return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    if (!deviceId) return NextResponse.json({ error: 'Missing device id' }, { status: 400 });

    const room = await prisma.gameRoom.findUnique({
      where: { code },
      include: { players: true },
    });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if (room.status !== 'WAITING') {
      return NextResponse.json({ error: 'This room has already started' }, { status: 409 });
    }

    // Rejoining from the same device — update the existing seat.
    const mine = room.players.find((p) => p.deviceId === deviceId);
    if (mine) {
      await prisma.gamePlayer.update({
        where: { id: mine.id },
        data: { name, color: requestedColor || mine.color, avatarUrl },
      });
      const updated = await prisma.gameRoom.findUnique({
        where: { id: room.id },
        include: { players: true },
      });
      return NextResponse.json({ room: { ...updated, players: orderPlayers(updated!.players) }, player: mine.id });
    }

    if (room.players.length >= room.maxPlayers) {
      return NextResponse.json({ error: 'Room is full' }, { status: 409 });
    }

    const taken = new Set(room.players.map((p) => p.color));
    const color = requestedColor && !taken.has(requestedColor) ? requestedColor : COLOR_ORDER.find((c) => !taken.has(c));
    if (!color) return NextResponse.json({ error: 'Room is full' }, { status: 409 });

    const player = await prisma.gamePlayer.create({
      data: { roomId: room.id, name, color, ready: false, deviceId, avatarUrl },
    });

    const updated = await prisma.gameRoom.findUnique({
      where: { id: room.id },
      include: { players: true },
    });
    return NextResponse.json({ room: { ...updated, players: orderPlayers(updated!.players) }, player: player.id });
  } catch (error) {
    console.error('Join room failed:', error);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
