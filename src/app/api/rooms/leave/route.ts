import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * POST /api/rooms/leave — remove a seat (player left the lobby).
 * Body: { code, deviceId }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim().toUpperCase();
    const deviceId = body.deviceId ? String(body.deviceId).slice(0, 64) : null;
    if (!code || !deviceId) {
      return NextResponse.json({ error: 'code and deviceId are required' }, { status: 400 });
    }

    const room = await prisma.gameRoom.findUnique({ where: { code }, include: { players: true } });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const me = room.players.find((p) => p.deviceId === deviceId);
    if (me) {
      await prisma.gamePlayer.delete({ where: { id: me.id } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Leave room failed:', error);
    return NextResponse.json({ error: 'Failed to leave room' }, { status: 500 });
  }
}
