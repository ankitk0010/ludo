import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isImageAvatar } from '@/game/avatars';

/** Public: top players leaderboard (shown on the home page). */
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ wins: 'desc' }, { xp: 'desc' }],
      take: 10,
      select: {
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
  } catch {
    return NextResponse.json({ leaderboard: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomCode, winnerColor, winnerName, turnsCount } = body;

    if (!roomCode || !winnerColor) {
      return NextResponse.json({ error: 'Missing match details' }, { status: 400 });
    }

    const room = await prisma.gameRoom.findUnique({
      where: { code: roomCode },
      include: { players: true },
    });

    if (!room) {
      return NextResponse.json({ message: 'Match logged locally (Room not synced to DB)' });
    }

    // Attribute the win to the winner's REAL account (their room seat). A
    // display-name / avatar edit must never create a duplicate leaderboard
    // user, so we key off the seat's userId rather than the display name.
    let winnerUserId: string | null = null;
    const winnerSeat = room.players.find((p) => p.color === winnerColor);
    if (winnerSeat?.userId) {
      winnerUserId = winnerSeat.userId;
      await prisma.user.update({
        where: { id: winnerSeat.userId },
        data: { wins: { increment: 1 }, games: { increment: 1 }, xp: { increment: 250 } },
      });
    } else if (winnerName) {
      const user = await prisma.user.upsert({
        where: { username: winnerName },
        update: { wins: { increment: 1 }, games: { increment: 1 }, xp: { increment: 250 } },
        create: { username: winnerName, wins: 1, games: 1, xp: 250 },
      });
      winnerUserId = user.id;
    }

    const match = await prisma.gameMatch.create({
      data: {
        roomId: room.id,
        winnerId: winnerUserId,
        winnerColor,
        turnsCount: turnsCount || 0,
        endedAt: new Date(),
      },
    });

    return NextResponse.json({ match, success: true });
  } catch (error) {
    console.error('Error recording match:', error);
    return NextResponse.json({ error: 'Failed to record match' }, { status: 500 });
  }
}
