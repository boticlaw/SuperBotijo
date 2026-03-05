import { getActivities, Activity } from "@/lib/activities-db";

export const dynamic = "force-dynamic";

interface SSEMessage {
  type: "connected" | "batch" | "new" | "ping";
  activities?: Activity[];
  activity?: Activity;
}

function encodeSSE(data: SSEMessage): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();
  let lastCheck = Date.now();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(encodeSSE({ type: "connected" })));

      // Send initial batch of recent activities
      const recent = getActivities({ limit: 20, sort: "newest" });
      if (recent.activities.length > 0) {
        controller.enqueue(encoder.encode(encodeSSE({
          type: "batch",
          activities: recent.activities,
        })));
      }
      lastCheck = Date.now();

      // Polling interval for new activities
      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          // Check for activities newer than last check
          const newActivities = getActivities({
            limit: 10,
            sort: "newest",
            startDate: new Date(lastCheck).toISOString(),
          });

          if (newActivities.activities.length > 0) {
            // Send each new activity
            for (const activity of newActivities.activities) {
              if (!closed) {
                controller.enqueue(encoder.encode(encodeSSE({
                  type: "new",
                  activity,
                })));
              }
            }
          }

          lastCheck = Date.now();
        } catch (error) {
          console.error("[SSE] Error polling activities:", error);
        }
      }, 2000); // Poll every 2 seconds

      // Keepalive ping every 15 seconds
      const keepalive = setInterval(() => {
        if (closed) {
          clearInterval(keepalive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(encodeSSE({ type: "ping" })));
        } catch {
          // Stream closed
        }
      }, 15000);

      // Cleanup on close
      const cleanup = () => {
        closed = true;
        clearInterval(interval);
        clearInterval(keepalive);
      };

      // Handle abort signal
      return cleanup;
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
