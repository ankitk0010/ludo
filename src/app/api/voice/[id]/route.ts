import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { voiceAdminUser } from '@/lib/voiceAdmin';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** Admin: edit a voice phrase (text, language, category, audio, active, order…). */
export async function PATCH(request: Request, ctx: Ctx) {
  const admin = await voiceAdminUser(request);
  if (!admin) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.text === 'string') data.text = body.text.trim().slice(0, 120);
    if (typeof body.language === 'string') data.language = body.language.slice(0, 8);
    if (typeof body.category === 'string') data.category = body.category.toUpperCase().slice(0, 24);
    if ('audioUrl' in body) data.audioUrl = body.audioUrl ? String(body.audioUrl).slice(0, 600) : null;
    if ('icon' in body) data.icon = body.icon ? String(body.icon).slice(0, 12) : '🎙️';
    if ('characterId' in body) data.characterId = body.characterId ? String(body.characterId) : null;
    if ('isActive' in body) data.isActive = !!body.isActive;
    if ('sortOrder' in body) data.sortOrder = Math.max(0, Math.floor(Number(body.sortOrder) || 0));

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const phrase = await prisma.voicePhrase.update({ where: { id }, data });
    return NextResponse.json({ phrase });
  } catch {
    return NextResponse.json({ error: 'Failed to update phrase' }, { status: 404 });
  }
}

/** Admin: delete a phrase. */
export async function DELETE(request: Request, ctx: Ctx) {
  const admin = await voiceAdminUser(request);
  if (!admin) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });
  const { id } = await ctx.params;

  try {
    await prisma.voicePhrase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Phrase not found' }, { status: 404 });
  }
}