import { subscribeRoom } from '@/lib/roomBus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * GET /api/rooms/[code]/game/stream — Low-latency Server-Sent Events.
 * Pushes game state & live voice PCM packets directly from RAM.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const key = code.toUpperCase();
  const encoder = new TextEncoder();

  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* client went away */
        }
      };

      const unsubscribe = subscribeRoom(key, send);

      // Heartbeat comment every 15s to keep proxy connections alive
      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`:ping\n\n`));
        } catch {
          /* connection closed */
        }
      }, 15000);

      request.signal.addEventListener('abort', () => {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
