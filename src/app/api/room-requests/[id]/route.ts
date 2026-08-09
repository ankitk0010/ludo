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

/**
 * PATCH /api/room-requests/[id]
 * Body: { action: 'accept' | 'decline' | 'cancel' }
 * - accept / decline → only the invited player.
 * - cancel → only the sender.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await currentUser(request);
    if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';

    const req = await prisma.roomRequest.findUnique({
      where: { id },
      include: { from: true, to: true, room: true },
    });
    if (!req) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    if (req.status !== RoomRequestStatus.PENDING) {
      return NextResponse.json({ error: 'This invite has already been answered' }, { status: 409 });
    }

    if (action === 'accept' || action === 'decline') {
      if (req.toId !== me.id) {
        return NextResponse.json({ error: 'Only the invited player can answer this invite' }, { status: 403 });
      }
      await prisma.roomRequest.update({
        where: { id },
        data: {
          status: action === 'accept' ? RoomRequestStatus.ACCEPTED : RoomRequestStatus.DECLINED,
          respondedAt: new Date(),
        },
      });
    } else if (action === 'cancel') {
      if (req.fromId !== me.id) {
        return NextResponse.json({ error: 'Only the sender can cancel this invite' }, { status: 403 });
      }
      await prisma.roomRequest.update({
        where: { id },
        data: { status: RoomRequestStatus.CANCELLED, respondedAt: new Date() },
      });
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const updated = await prisma.roomRequest.findUnique({
      where: { id },
      include: { from: true, to: true, room: true },
    });
    return NextResponse.json({
      request: {
        id: updated!.id,
        status: updated!.status,
        roomCode: updated!.room.code,
        roomStatus: updated!.room.status,
        createdAt: updated!.createdAt,
        respondedAt: updated!.respondedAt,
        from: toUserPayload(updated!.from),
        to: toUserPayload(updated!.to),
      },
    });
  } catch (error) {
    console.error('Room request response failed:', error);
    return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 });
  }
}