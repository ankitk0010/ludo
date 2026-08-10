import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// VAPID keys — generated once per deployment.
// In production set these via environment variables:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (also used on the client)
//   VAPID_PRIVATE_KEY
//   VAPID_EMAIL
const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BDY5-Qe33-3iIzWpmPf6Pm-S3bIA0f2TxX1nCS7zMtwork1hIPQuRK4uzPS7OYN0K68TWkfW01lmi0sNClRzYcI';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'vx_u2IJWLWJOZTC01kXwxJhOeI1qtSuKZXFBlydmXag';

const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@ludomaster.app';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, title, message, roomCode } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Missing push subscription' }, { status: 400 });
    }

    const payload = JSON.stringify({
      title: title || '🎲 Ludo Invitation!',
      body: message || `A friend invited you to a Ludo match! Room: ${roomCode || 'Join Now'}`,
      roomCode,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[notify] Failed to send push notification:', err);
    // 410 Gone means the subscription is expired — client should re-subscribe
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 410) {
      return NextResponse.json({ error: 'Subscription expired', expired: true }, { status: 410 });
    }
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

// Return VAPID public key so client can subscribe without env access
export async function GET() {
  return NextResponse.json({ publicKey: VAPID_PUBLIC_KEY });
}
