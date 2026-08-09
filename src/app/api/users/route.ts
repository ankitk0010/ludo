import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toUserPayload } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * GET /api/users?username=… | ?id=…
 * Public player-card lookup used by the opponent profile sheet to show real
 * account stats (wins / xp / level) when a room player has a Ludo account.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username')?.trim();
    const id = searchParams.get('id')?.trim();
    if (!username && !id) {
      return NextResponse.json({ error: 'username or id is required' }, { status: 400 });
    }

    const user = username
      ? await prisma.user.findFirst({
          where: {
            OR: [
              { username: { equals: username, mode: 'insensitive' } },
              { displayName: { equals: username, mode: 'insensitive' } },
            ],
          },
        })
      : await prisma.user.findUnique({ where: { id: id! } });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ user: toUserPayload(user) });
  } catch (error) {
    console.error('User lookup failed:', error);
    return NextResponse.json({ error: 'Failed to look up player' }, { status: 500 });
  }
}