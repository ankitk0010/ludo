import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (token) {
      await prisma.authSession.deleteMany({ where: { token } }).catch(() => {});
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}