import { subscribeRoom } from '@/lib/roomBus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * GET /api/rooms/[code]/game/stream — Server-Sent Events.
 * Subscribes to the in-memory room bus and pushes every authoritative state
 * change / voice message as soon as it happens, so clients stop lagging a
 * whole poll interval behind the action. The client keeps a slow poll as a
 * fallback for missed events / multi-instance deployments.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const key = code.toUpperCase();
  const encoder = new TextEncoder();

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
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      /* listener cleanup happens via the abort signal */
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
