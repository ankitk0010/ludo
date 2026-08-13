import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createSessionToken, sessionExpiry, toUserPayload } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = body.displayName ? String(body.displayName).trim() : '';
    const emailRaw = body.email ? String(body.email).trim().toLowerCase() : '';
    const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;
    const characterId = ['red', 'green', 'yellow', 'blue'].includes(body.characterId)
      ? body.characterId
      : 'red';

    if (!username || username.length < 2 || username.length > 16) {
      return NextResponse.json({ error: 'Username must be 2-16 characters' }, { status: 400 });
    }
    if (!/^[\w.]+$/.test(username)) {
      return NextResponse.json({ error: 'Username may only contain letters, numbers, dots and underscores' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 });
    }
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return NextResponse.json({ error: 'That email is already registered' }, { status: 409 });
      }
    }

    const avatar = body.avatar && typeof body.avatar === 'string' && body.avatar.trim()
      ? body.avatar.trim()
      : '🦊';

    const user = await prisma.user.create({
      data: {
        username,
        displayName: displayName || null,
        passwordHash: hashPassword(password),
        characterId,
        avatar,
        email,
      },
    });

    const session = await prisma.authSession.create({
      data: { token: createSessionToken(), userId: user.id, expiresAt: sessionExpiry() },
    });

    return NextResponse.json({ user: toUserPayload(user), token: session.token }, { status: 201 });
  } catch (error) {
    console.error('Signup failed:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}