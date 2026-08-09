import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSessionToken, sessionExpiry, toUserPayload } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const session = await prisma.authSession.create({
      data: { token: createSessionToken(), userId: user.id, expiresAt: sessionExpiry() },
    });

    return NextResponse.json({ user: toUserPayload(user), token: session.token });
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Failed to log in' }, { status: 500 });
  }
}