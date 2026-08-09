import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { voiceAdminUser } from '@/lib/voiceAdmin';

export const runtime = 'nodejs';

/** Public: the active phrase library for the game. Admins may pass ?all=1. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('all') === '1';
    const admin = includeInactive ? await voiceAdminUser(request) : null;

    const phrases = await prisma.voicePhrase.findMany({
      where: includeInactive && admin ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ phrases });
  } catch {
    // DB offline — client falls back to built-in phrases.
    return NextResponse.json({ phrases: [] });
  }
}

/** Admin: create a voice phrase. */
export async function POST(request: Request) {
  const admin = await voiceAdminUser(request);
  if (!admin) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body.text || '').trim();
    if (!text) return NextResponse.json({ error: 'Phrase text is required' }, { status: 400 });

    const phrase = await prisma.voicePhrase.create({
      data: {
        text: text.slice(0, 120),
        language: String(body.language || 'hi').slice(0, 8),
        category: String(body.category || 'REACTION').toUpperCase().slice(0, 24),
        audioUrl: body.audioUrl ? String(body.audioUrl).slice(0, 600) : null,
        icon: body.icon ? String(body.icon).slice(0, 12) : '🎙️',
        characterId: body.characterId ? String(body.characterId) : null,
        isActive: body.isActive !== false,
        sortOrder: typeof body.sortOrder === 'number' ? Math.max(0, Math.floor(body.sortOrder)) : 0,
        createdBy: admin.username,
      },
    });
    return NextResponse.json({ phrase });
  } catch (error) {
    console.error('Voice create failed', error);
    return NextResponse.json({ error: 'Failed to create phrase' }, { status: 500 });
  }
}