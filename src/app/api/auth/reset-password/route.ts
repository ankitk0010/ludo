import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, createSessionToken, sessionExpiry, toUserPayload } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 * Validates the reset token, sets a new password and logs the user in.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '');
    const password = String(body.password || '');

    if (!token) {
      return NextResponse.json({ error: 'Reset token is missing or has expired' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.usedAt) {
      return NextResponse.json({ error: 'Reset token is invalid or has already been used' }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Reset token has expired. Request a new one.' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: hashPassword(password) },
    });

    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    // Issue a fresh session so the user is signed in right after resetting.
    const session = await prisma.authSession.create({
      data: { token: createSessionToken(), userId: user.id, expiresAt: sessionExpiry() },
    });

    return NextResponse.json({ ok: true, user: toUserPayload(user), token: session.token });
  } catch (error) {
    console.error('Reset password failed:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
