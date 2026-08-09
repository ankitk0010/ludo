import { prisma } from '@/lib/prisma';

/*
 * Server-side authorization for voice-library management.
 * Admin is decided on the server only — never by client flags.
 * Default admin username is "admin"; override with ADMIN_USERNAMES (comma
 * separated, case-insensitive).
 */
export async function voiceAdminUser(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;

    const session = await prisma.authSession.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) return null;

    const raw = process.env.ADMIN_USERNAMES || 'admin';
    const admins = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (admins.length === 0) return null;
    if (!admins.includes(session.user.username.toLowerCase())) return null;
    return session.user;
  } catch {
    return null;
  }
}