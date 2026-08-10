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

/** Admin: upload an audio clip; stored on disk or data URI fallback. */
export async function POST(request: Request) {
  const admin = await voiceAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    const fileObj = file as File;
    const fileName = fileObj.name || 'sound.mp3';
    const ext = path.extname(fileName).toLowerCase() || '.mp3';
    const isMimeValid = ALLOWED_TYPES.has(fileObj.type);
    const isExtValid = ALLOWED_EXTS.has(ext);

    if (!isMimeValid && !isExtValid) {
      return NextResponse.json(
        { error: 'Unsupported audio format. Please upload MP3, WAV, OGG, M4A, or WEBM audio files.' },
        { status: 415 }
      );
    }
    if (fileObj.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio file too large. Maximum file size is 2.5MB.' }, { status: 413 });
    }

    const arrayBuffer = await fileObj.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let audioUrl: string;
    try {
      const safeName = `sfx-${randomUUID()}${ext}`;
      const dir = path.join(process.cwd(), 'public', 'uploads', 'voice');
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, safeName), buffer);
      audioUrl = `/uploads/voice/${safeName}`;
    } catch (diskError) {
      console.warn('Disk write unavailable, using Data URI fallback:', diskError);
      const mime = fileObj.type || 'audio/mpeg';
      audioUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    return NextResponse.json({ url: audioUrl });
  } catch (error) {
    console.error('Voice upload error:', error);
    const msg = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}