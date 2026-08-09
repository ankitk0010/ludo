import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { voiceAdminUser } from '@/lib/voiceAdmin';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users?q=&sort=
 * Paginated player list for the admin dashboard. Admins only.
 */
export async function GET(request: Request) {
  const admin = await voiceAdminUser(request);
  if (!admin) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const sort = searchParams.get('sort') || 'xp';
    const take = Math.min(Math.max(Number(searchParams.get('take') || 25), 1), 100);

    const orderBy =
      sort === 'wins'
        ? { wins: 'desc' as const }
        : sort === 'games'
          ? { games: 'desc' as const }
          : { xp: 'desc' as const };

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy,
      take,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatar: true,
        characterId: true,
        level: true,
        wins: true,
        games: true,
        xp: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin users failed:', error);
    return NextResponse.json({ error: 'Failed to load players' }, { status: 500 });
  }
}
