import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isImageAvatar } from '@/game/avatars';

export const runtime = 'nodejs';

/** Public: top players leaderboard (shown on home page & in game). */
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ wins: 'desc' }, { xp: 'desc' }],
      take: 20,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        characterId: true,
        wins: true,
        games: true,
        xp: true,
        level: true,
      },
    });
    return NextResponse.json({
      leaderboard: users.map((u) => ({
        ...u,
        avatarUrl: isImageAvatar(u.avatar) ? u.avatar : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ leaderboard: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { roomCode, winnerColor, winnerName, turnsCount } = body;

    if (!winnerColor) {
      return NextResponse.json({ error: 'Missing match details (winnerColor required)' }, { status: 400 });
    }

    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

    let meId: string | null = null;
    if (token) {
      const session = await prisma.authSession.findUnique({
        where: { token },
        select: { userId: true, expiresAt: true },
      });
      if (session && session.expiresAt >= new Date()) {
        meId = session.userId;
      }
    }

    const code = typeof roomCode === 'string' ? roomCode.trim().toUpperCase() : '';
    const room = code
      ? await prisma.gameRoom.findUnique({
          where: { code },
          include: { players: { include: { user: true } } },
        })
      : null;

    let winnerUserId: string | null = null;
    let currentUserUpdated = null;

    if (room) {
      // 1. Process all room players in DB
      for (const p of room.players) {
        if (p.userId) {
          const isWinner = p.color === winnerColor;
          if (isWinner) winnerUserId = p.userId;

          const user = await prisma.user.findUnique({ where: { id: p.userId } });
          if (user) {
            const newXp = user.xp + (isWinner ? 250 : 50);
            const newWins = user.wins + (isWinner ? 1 : 0);
            const newGames = user.games + 1;
            const newLevel = Math.floor(newXp / 500) + 1;

            const updated = await prisma.user.update({
              where: { id: user.id },
              data: { wins: newWins, games: newGames, xp: newXp, level: newLevel },
            });
            if (user.id === meId) currentUserUpdated = updated;
          }
        }
      }

      // Mark room as finished
      await prisma.gameRoom.update({
        where: { id: room.id },
        data: { status: 'FINISHED' },
      }).catch(() => {});
    }

    // 2. If room was not found or played locally, update the signed-in user if token provided
    if (!room && meId) {
      const user = await prisma.user.findUnique({ where: { id: meId } });
      if (user) {
        const isWinner = user.characterId === winnerColor || (winnerName && user.username.toLowerCase() === winnerName.toLowerCase());
        if (isWinner) winnerUserId = user.id;

        const newXp = user.xp + (isWinner ? 250 : 50);
        const newWins = user.wins + (isWinner ? 1 : 0);
        const newGames = user.games + 1;
        const newLevel = Math.floor(newXp / 500) + 1;

        currentUserUpdated = await prisma.user.update({
          where: { id: meId },
          data: { wins: newWins, games: newGames, xp: newXp, level: newLevel },
        });
      }
    }

    // 3. Fallback name search if winnerId is still unknown
    if (!winnerUserId && winnerName) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: winnerName, mode: 'insensitive' } },
            { displayName: { equals: winnerName, mode: 'insensitive' } },
          ],
        },
      });
      if (user) {
        winnerUserId = user.id;
        const newXp = user.xp + 250;
        const newWins = user.wins + 1;
        const newGames = user.games + 1;
        const newLevel = Math.floor(newXp / 500) + 1;

        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { wins: newWins, games: newGames, xp: newXp, level: newLevel },
        });
        if (user.id === meId) currentUserUpdated = updated;
      }
    }

    // 4. Create Match record if room exists
    let match = null;
    if (room) {
      match = await prisma.gameMatch.create({
        data: {
          roomId: room.id,
          winnerId: winnerUserId,
          winnerColor,
          turnsCount: turnsCount || 0,
          endedAt: new Date(),
        },
      }).catch(() => null);
    }

    return NextResponse.json({ success: true, match, user: currentUserUpdated });
  } catch (error) {
    console.error('Error recording match:', error);
    return NextResponse.json({ error: 'Failed to record match' }, { status: 500 });
  }
}
