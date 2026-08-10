import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { GameState } from '@/game/engine/types';
import { GameAction } from '@/game/engine/reducer';
import { buildRoomSeats, newRoomGameState, applyRoomGameAction } from '@/lib/roomGame';
import { RoomVoiceMessage, emitRoom } from '@/lib/roomBus';

export const runtime = 'nodejs';

const MAX_VOICE = 24;
const CACHE_TTL_MS = 4000;

/*
 * In-memory write-through cache: poll/action reads are instant instead of
 * hitting the (possibly remote) database on every tick. Every write updates
 * both the cache and the DB. A short TTL keeps the cache in sync if a room is
 * deleted elsewhere.
 */
interface RoomCache {
  id: string;
  status: string;
  state: GameState | null;
  voiceMessages: RoomVoiceMessage[];
  at: number;
}
const roomCache = new Map<string, RoomCache>();

async function loadRoom(code: string): Promise<RoomCache | null> {
  const cached = roomCache.get(code);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

  const room = await prisma.gameRoom.findUnique({ where: { code } });
  if (!room) {
    roomCache.delete(code);
    return null;
  }
  const entry: RoomCache = {
    id: room.id,
    status: room.status,
    state: room.state as unknown as GameState | null,
    voiceMessages: (room.voiceMessages as unknown as RoomVoiceMessage[]) || [],
    at: Date.now(),
  };
  roomCache.set(code, entry);
  return entry;
}

/** GET /api/rooms/[code]/game — authoritative room-match state + voice inbox. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const key = code.toUpperCase();
    const entry = await loadRoom(key);
    if (!entry) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    return NextResponse.json({
      code: key,
      status: entry.status,
      state: entry.state,
      voiceMessages: entry.voiceMessages,
    });
  } catch (error) {
    console.error('Room game state failed:', error);
    return NextResponse.json({ error: 'Failed to load game' }, { status: 500 });
  }
}

/**
 * POST /api/rooms/[code]/game
 *  { deviceId, voice: { phraseId, text, language, icon } } → broadcast a voice line
 *  { deviceId, action: { start: true } }                   → start the match
 *  { deviceId, action: <GameAction> }                      → apply a turn action
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const key = code.toUpperCase();
    const body = await request.json().catch(() => ({}));
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 64) : null;
    if (!deviceId) return NextResponse.json({ error: 'Missing device id' }, { status: 400 });

    const entry = await loadRoom(key);
    if (!entry) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    // ---- Live Microphone Voice Stream Relay ----
    if (body.liveVoice) {
      const lv = body.liveVoice;
      if (typeof lv.audioBase64 === 'string' && entry.state) {
        const sender = entry.state.players.find((p) => p.id === deviceId);
        if (sender) {
          const chunk = {
            id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            byDeviceId: deviceId,
            byName: sender.name,
            byColor: sender.color,
            audioBase64: lv.audioBase64,
            mimeType: typeof lv.mimeType === 'string' ? lv.mimeType : 'audio/webm',
            at: Date.now(),
          };
          emitRoom(key, { type: 'live_voice', chunk });
          return NextResponse.json({ ok: true });
        }
      }
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // ---- Voice line relay (delivered to the other players) ----
    if (body.voice) {
      const room = await prisma.gameRoom.findUnique({
        where: { code: key },
        include: { players: true },
      });
      if (!room) {
        roomCache.delete(key);
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }
      const member = room.players.find((p) => p.deviceId === deviceId);
      if (!member) return NextResponse.json({ error: 'You are not in this room' }, { status: 403 });

      const v = body.voice;
      const msg: RoomVoiceMessage = {
        id: typeof v.id === 'string' && v.id ? v.id : `v${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        byDeviceId: deviceId,
        byName: member.name,
        byColor: member.color,
        phraseId: typeof v.phraseId === 'string' ? v.phraseId : 'custom',
        text: typeof v.text === 'string' ? v.text.slice(0, 80) : '',
        language: typeof v.language === 'string' ? v.language : 'en',
        icon: typeof v.icon === 'string' ? v.icon : '🎙️',
        at: Date.now(),
      };
      const list = [...entry.voiceMessages, msg].slice(-MAX_VOICE);
      entry.voiceMessages = list;
      entry.at = Date.now();

      // Emit SSE immediately, persist DB asynchronously
      emitRoom(key, { type: 'voice', voiceMessages: list });
      prisma.gameRoom.update({
        where: { id: room.id },
        data: { voiceMessages: list as unknown as Prisma.InputJsonValue },
      }).catch((e) => console.error('Async DB update error:', e));

      return NextResponse.json({ voiceMessages: list });
    }

    // ---- Start the match ----
    if (body.action && body.action.start === true) {
      const room = await prisma.gameRoom.findUnique({
        where: { code: key },
        include: { players: true },
      });
      if (!room) {
        roomCache.delete(key);
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }
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
      const state = newRoomGameState(seats, key);
      entry.status = 'PLAYING';
      entry.state = state;
      entry.at = Date.now();

      // Emit SSE immediately, persist DB asynchronously
      emitRoom(key, { type: 'state', status: 'PLAYING', state });
      prisma.gameRoom.update({
        where: { id: room.id },
        data: { status: 'PLAYING', state: state as unknown as Prisma.InputJsonValue },
      }).catch((e) => console.error('Async DB update error:', e));

      return NextResponse.json({ state, players: seats });
    }

    // ---- Apply a turn action ----
    const action = body.action as GameAction;
    if (!action || typeof action.type !== 'string') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (entry.status !== 'PLAYING' || !entry.state) {
      return NextResponse.json({ error: 'Game not started' }, { status: 409 });
    }
    // The actor must own a seat in the authoritative roster (id === deviceId).
    if (!entry.state.players.some((p) => p.id === deviceId)) {
      return NextResponse.json({ error: 'You are not in this game' }, { status: 403 });
    }

    const res = applyRoomGameAction(entry.state, action, deviceId);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 403 });
    }

    entry.state = res.state;
    entry.at = Date.now();

    // Memory-first fast broadcast: emit SSE right away for 0ms lag across connected clients!
    emitRoom(key, { type: 'state', status: 'PLAYING', state: res.state });
    prisma.gameRoom.update({
      where: { id: entry.id },
      data: { state: res.state as unknown as Prisma.InputJsonValue },
    }).catch((e) => console.error('Async DB update error:', e));

    return NextResponse.json({ state: res.state, players: res.state.players });
  } catch (error) {
    console.error('Room game action failed:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}