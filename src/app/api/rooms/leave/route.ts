import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GameState } from '@/game/engine/types';
import { advanceTurn } from '@/game/engine/reducer';
import { emitRoom } from '@/lib/roomBus';
import { setCachedRoom, invalidateRoomCache } from '@/lib/roomCache';

export const runtime = 'nodejs';

/**
 * POST /api/rooms/leave — handle player departure from lobby or active match.
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

    // Lobby mode (WAITING): broadcast SSE state update so seat becomes empty immediately
    if (room.status === 'WAITING') {
      invalidateRoomCache(code);
      emitRoom(code, {
        type: 'state',
        status: 'WAITING',
        state: null,
      });
      return NextResponse.json({ ok: true });
    }

    // Active match (PLAYING): mark disconnected, check last remaining player
    if (room.status === 'PLAYING' && room.state) {
      let state = room.state as unknown as GameState;
      const updatedPlayers = state.players.map((p) =>
        p.id === deviceId || (me && p.color === me.color)
          ? { ...p, connected: false }
          : p
      );
      state = { ...state, players: updatedPlayers };

      const connectedPlayers = state.players.filter((p) => p.connected && !p.isBot);

      // If only 1 (or 0) connected human player remains -> LAST PLAYER WINS!
      if (connectedPlayers.length <= 1 && !state.winner) {
        const winnerPlayer = connectedPlayers[0] || state.players.find((p) => p.connected) || state.players[0];
        state = {
          ...state,
          status: 'finished',
          winner: winnerPlayer.color,
          logs: [
            ...state.logs,
            `🎉 ${winnerPlayer.name} HAS WON THE GAME! (All opponents left the match) 🎉`,
          ],
        };

        setCachedRoom(code, {
          id: room.id,
          status: 'FINISHED',
          state,
          voiceMessages: [],
          at: Date.now(),
        });

        await prisma.gameRoom.update({
          where: { id: room.id },
          data: {
            status: 'FINISHED',
            state: state as unknown as object,
          },
        });
        emitRoom(code, { type: 'state', status: 'FINISHED', state });
        return NextResponse.json({ ok: true, winner: winnerPlayer.color, closed: true });
      }

      // If 2+ connected players remain, advance turn if leaving player owned current turn
      const currentTurnPlayer = state.players[state.currentTurnIndex];
      if (currentTurnPlayer && !currentTurnPlayer.connected) {
        state = advanceTurn(state, false, `${currentTurnPlayer.name} left the room. Skipping turn.`);
      }

      setCachedRoom(code, {
        id: room.id,
        status: 'PLAYING',
        state,
        voiceMessages: [],
        at: Date.now(),
      });

      await prisma.gameRoom.update({
        where: { id: room.id },
        data: { state: state as unknown as object },
      });
      emitRoom(code, { type: 'state', status: 'PLAYING', state });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Leave room failed:', error);
    return NextResponse.json({ error: 'Failed to leave room' }, { status: 500 });
  }
}
