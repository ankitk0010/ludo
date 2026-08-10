import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { voiceAdminUser } from '@/lib/voiceAdmin';

export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/webm',
  'audio/aac',
]);
const ALLOWED_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.aac']);
const MAX_BYTES = 2.5 * 1024 * 1024; // 2.5MB max

/** Admin: upload an audio clip; stored on disk, DB keeps only the URL. */
export async function POST(request: Request) {
  const admin = await voiceAdminUser(request);
  if (!admin) return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const ext = path.extname(file.name || '').toLowerCase() || '.mp3';
    const isMimeValid = ALLOWED_TYPES.has(file.type);
    const isExtValid = ALLOWED_EXTS.has(ext);

    if (!isMimeValid && !isExtValid) {
      return NextResponse.json(
        { error: 'Unsupported audio format. Please upload MP3, WAV, OGG, M4A, or WEBM audio files.' },
        { status: 415 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio file too large. Maximum file size is 2.5MB.' }, { status: 413 });
    }

    const safeName = `sfx-${randomUUID()}${ext}`;
    const dir = path.join(process.cwd(), 'public', 'uploads', 'voice');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, safeName), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ url: `/uploads/voice/${safeName}` });
  } catch (error) {
    console.error('Voice upload failed', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}