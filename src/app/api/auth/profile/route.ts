import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toUserPayload } from '@/lib/auth';

function readBearer(request: Request): string | null {
  const auth = request.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

export async function GET(request: Request) {
  try {
    const token = readBearer(request);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const session = await prisma.authSession.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired — log in again' }, { status: 401 });
    }

    return NextResponse.json({ user: toUserPayload(session.user) });
  } catch (error) {
    console.error('Me failed:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const token = readBearer(request);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const session = await prisma.authSession.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired — log in again' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const data: { displayName?: string | null; characterId?: string; avatar?: string } = {};
    if (typeof body.displayName === 'string') {
      data.displayName = body.displayName.trim() || null;
    }
    if (typeof body.characterId === 'string') {
      data.characterId = body.characterId;
    }
    if (typeof body.avatar === 'string') {
      data.avatar = body.avatar;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const user = await prisma.user.update({ where: { id: session.userId }, data });
    return NextResponse.json({ user: toUserPayload(user) });
  } catch (error) {
    console.error('Profile update failed:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}