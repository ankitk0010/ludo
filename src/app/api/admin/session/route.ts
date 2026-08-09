import { NextResponse } from 'next/server';
import { voiceAdminUser } from '@/lib/voiceAdmin';

export const runtime = 'nodejs';

/**
 * GET /api/admin/session
 * Returns the signed-in admin (if the Bearer token belongs to an admin).
 * Used by /admin to gate the whole dashboard.
 */
export async function GET(request: Request) {
  const admin = await voiceAdminUser(request);
  if (!admin) {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
  return NextResponse.json({
    admin: {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      email: admin.email,
      avatar: admin.avatar,
      characterId: admin.characterId,
      level: admin.level,
      wins: admin.wins,
      games: admin.games,
      xp: admin.xp,
    },
  });
}
