import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail, appBaseUrl } from '@/lib/mailer';

export const runtime = 'nodejs';

const RESET_TTL_MS = 30 * 60 * 1000;

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Sends a password-reset email when the address belongs to an account.
 * Always responds "ok" so we never reveal whether an email is registered.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = randomBytes(32).toString('base64url');
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });

      const resetUrl = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      try {
        await sendPasswordResetEmail(email, resetUrl);
      } catch (error) {
        console.error('Reset email failed:', error);
        return NextResponse.json(
          { error: 'Email could not be sent. Check your SMTP configuration.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Forgot password failed:', error);
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
  }
}
