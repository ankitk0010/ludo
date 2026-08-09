import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { GameState } from '@/game/engine/types';
import { GameAction } from '@/game/engine/reducer';
import { buildRoomSeats, newRoomGameState, applyRoomGameAction } from '@/lib/roomGame';

export const runtime = 'nodejs';

/**
 * GET /api/rooms/[code]/game — the authoritative room-match state.
 * Every client (host + guests) polls this so everyone sees the same board.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await prisma.gameRoom.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    return NextResponse.json({ code: room.code, status: room.status, state: room.state });
  } catch (error) {
    console.error('Room game state failed:', error);
    return NextResponse.json({ error: 'Failed to load game' }, { status: 500 });
  }
}

/**
 * POST /api/rooms/[code]/game
 * Body: { deviceId, action: { start: true } }            → host starts the match
 *       { deviceId, action: <GameAction> }               → apply a turn action
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json().catch(() => ({}));
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 64) : null;
    if (!deviceId) return NextResponse.json({ error: 'Missing device id' }, { status: 400 });

    const room = await prisma.gameRoom.findUnique({
      where: { code: code.toUpperCase() },
      include: { players: true },
    });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const actor = room.players.find((p) => p.deviceId === deviceId);
    if (!actor) return NextResponse.json({ error: 'You are not in this room' }, { status: 403 });

    // ---- Start the match (any ready player can trigger it) ----
    if (body.action && body.action.start === true) {
      if (room.status !== 'WAITING') {
        return NextResponse.json({ error: 'This game has already started' }, { status: 409 });
      }
      if (room.players.length < 2) {
        return NextResponse.json({ error: 'Need at least 2 players' }, { status: 400 });
      }
      if (!room.players.every((p) => p.ready)) {
        return NextResponse.json({ error: 'Everyone must be ready' }, { status: 409 });
      }
      const seats = buildRoomSeats(room.players);
      const state = newRoomGameState(seats, room.code);
      await prisma.gameRoom.update({
        where: { id: room.id },
        data: { status: 'PLAYING', state: state as unknown as Prisma.InputJsonValue },
      });
      return NextResponse.json({ state, players: seats });
    }

    // ---- Apply a turn action ----
    const action = body.action as GameAction;
    if (!action || typeof action.type !== 'string') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (room.status !== 'PLAYING' || !room.state) {
      return NextResponse.json({ error: 'Game not started' }, { status: 409 });
    }

    const state = room.state as unknown as GameState;
    const res = applyRoomGameAction(state, action, deviceId);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 403 });
    }

    await prisma.gameRoom.update({
      where: { id: room.id },
      data: { state: res.state as unknown as Prisma.InputJsonValue },
    });
    return NextResponse.json({ state: res.state, players: res.state.players });
  } catch (error) {
    console.error('Room game action failed:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}