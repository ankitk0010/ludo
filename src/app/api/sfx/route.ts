import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { voiceAdminUser } from '@/lib/voiceAdmin';

export const runtime = 'nodejs';

/** Public: the active SFX overrides the game engine will play. */
export async function GET() {
  try {
    const sfx = await prisma.sfxSetting.findMany({
      where: { isActive: true },
      orderBy: { key: 'asc' },
    });
    return NextResponse.json({ sfx });
  } catch {
    return NextResponse.json({ sfx: [] });
  }
}

/** Admin: create or update an SFX audio override. */
export async function POST(request: Request) {
  const admin = await voiceAdminUser(request);
  if (!admin) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const key = String(body.key || '').trim();
    if (!key) return NextResponse.json({ error: 'sfx key is required' }, { status: 400 });

    const data: { name: string; audioUrl: string | null; isActive: boolean } = {
      name: String(body.name || key).slice(0, 60),
      audioUrl: body.audioUrl ? String(body.audioUrl).slice(0, 3_500_000) : null,
      isActive: body.isActive !== false,
    };

    const sfx = await prisma.sfxSetting.upsert({
      where: { key },
      update: data,
      create: { key, ...data },
    });
    return NextResponse.json({ sfx });
  } catch (error) {
    console.error('SFX update failed', error);
    return NextResponse.json({ error: 'Failed to save sfx' }, { status: 500 });
  }
}