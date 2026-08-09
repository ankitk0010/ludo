import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { voiceAdminUser } from '@/lib/voiceAdmin';

export const runtime = 'nodejs';

/**
 * GET /api/admin/stats
 * Dashboard counters + recent registrations. Admins only.
 */
export async function GET(request: Request) {
  const admin = await voiceAdminUser(request);
  if (!admin) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });

  try {
    const [users, rooms, matches, voicePhrases, activePhrases, sfx] = await Promise.all([
      prisma.user.count(),
      prisma.gameRoom.count(),
      prisma.gameMatch.count(),
      prisma.voicePhrase.count(),
      prisma.voicePhrase.count({ where: { isActive: true } }),
      prisma.sfxSetting.count(),
    ]);

    const recent = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        characterId: true,
        level: true,
        wins: true,
        games: true,
        xp: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      stats: {
        users,
        rooms,
        matches,
        voicePhrases,
        activePhrases,
        sfx,
      },
      recent,
    });
  } catch (error) {
    console.error('Admin stats failed:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
