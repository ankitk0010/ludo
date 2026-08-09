import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (code) {
      const room = await prisma.gameRoom.findUnique({
        where: { code: code.toUpperCase() },
        include: {
          players: true,
          host: true,
        },
      });
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }
      return NextResponse.json({ room });
    }

    const rooms = await prisma.gameRoom.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { players: true },
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json({ error: 'Database connection offline or error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, hostName = 'Host Player' } = body;

    const roomCode = code || Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create or find default user for host
    const user = await prisma.user.upsert({
      where: { username: hostName },
      update: {},
      create: { username: hostName, avatar: '🦊' },
    });

    const room = await prisma.gameRoom.create({
      data: {
        code: roomCode,
        hostId: user.id,
        players: {
          create: {
            userId: user.id,
            name: hostName,
            color: 'red',
            ready: true,
          },
        },
      },
      include: { players: true },
    });

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}
