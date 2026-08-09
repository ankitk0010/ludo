import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'];

/**
 * PATCH /api/rooms/ready — toggle readiness for a seat.
 * Body: { code, deviceId, ready }
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim().toUpperCase();
    const deviceId = body.deviceId ? String(body.deviceId).slice(0, 64) : null;
    const ready = !!body.ready;

    if (!code || !deviceId) {
      return NextResponse.json({ error: 'code and deviceId are required' }, { status: 400 });
    }

    const room = await prisma.gameRoom.findUnique({ where: { code }, include: { players: true } });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const me = room.players.find((p) => p.deviceId === deviceId);
    if (!me) return NextResponse.json({ error: 'You are not in this room' }, { status: 404 });

    await prisma.gamePlayer.update({ where: { id: me.id }, data: { ready } });

    const updated = await prisma.gameRoom.findUnique({
      where: { id: room.id },
      include: { players: true },
    });
    const players = updated!.players
      .slice()
      .sort((a, b) => COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color));
    return NextResponse.json({ room: { ...updated, players } });
  } catch (error) {
    console.error('Ready toggle failed:', error);
    return NextResponse.json({ error: 'Failed to update readiness' }, { status: 500 });
  }
}
