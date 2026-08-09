import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { voiceAdminUser } from '@/lib/voiceAdmin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ key: string }> };

/** Admin: toggle or clear an sfx setting. */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await voiceAdminUser(request);
  if (!session) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });
  const { key } = await ctx.params;

  try {
    const body = await request.json().catch(() => ({}));
    const data: { name?: string; audioUrl?: string | null; isActive?: boolean } = {};
    if (typeof body.name === 'string') data.name = body.name.slice(0, 60);
    if ('audioUrl' in body) data.audioUrl = body.audioUrl ? String(body.audioUrl).slice(0, 600) : null;
    if ('isActive' in body) data.isActive = !!body.isActive;

    const sfx = await prisma.sfxSetting.update({ where: { key }, data });
    return NextResponse.json({ sfx });
  } catch {
    return NextResponse.json({ error: 'SFX setting not found' }, { status: 404 });
  }
}

/** Admin: delete the override (resets to the built-in oscillator sound). */
export async function DELETE(request: Request, ctx: Ctx) {
  const session = await voiceAdminUser(request);
  if (!session) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });
  const { key } = await ctx.params;

  try {
    await prisma.sfxSetting.delete({ where: { key } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'SFX setting not found' }, { status: 404 });
  }
}