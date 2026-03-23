/**
 * Real-time bidirectional stream via SSE
 * GET /api/realtime
 * 
 * Provides a WebSocket-like experience over SSE with:
 * - Lower latency (configurable poll interval)
 * - Multiple channel subscriptions
 * - Automatic reconnection with backoff
 * - Heartbeat to detect dead connections
 */
import { NextRequest } from 'next/server';
import { getActivities } from '@/lib/activities-db';
import { createEvent, CHANNELS, type ChannelName } from '@/lib/realtime-events';

export const dynamic = "force-dynamic";

// In-memory subscription store (resets on server restart, but that's fine for SSE)
const clientSubscriptions = new Map<string, Set<ChannelName>>();

// Default channels if none specified
const DEFAULT_CHANNELS: ChannelName[] = [
  CHANNELS.ACTIVITIES,
  CHANNELS.AGENTS,
  CHANNELS.NOTIFICATIONS,
];

// Generate a simple client ID
function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Exponential backoff calculation
function getBackoffMs(attempt: number): number {
  const baseMs = 1000;
  const maxMs = 30000;
  return Math.min(baseMs * Math.pow(2, attempt), maxMs);
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const clientId = generateClientId();
  let closed = false;
  let lastActivityId: string | null = null;
  let pollAttempt = 0;
  let subscriptions = new Set<ChannelName>(DEFAULT_CHANNELS);

  // Parse requested channels from URL
  const url = new URL(request.url);
  const channelsParam = url.searchParams.get('channels');
  if (channelsParam) {
    const requested = channelsParam.split(',').filter(c => 
      Object.values(CHANNELS).includes(c as ChannelName)
    ) as ChannelName[];
    if (requested.length > 0) {
      subscriptions = new Set(requested);
    }
  }

  // Store subscriptions
  clientSubscriptions.set(clientId, subscriptions);

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      // Send connected event with client ID
      send(createEvent('connected', {
        clientId,
        serverTime: new Date().toISOString(),
      }));

      // Heartbeat to keep connection alive and detect dead clients
      const heartbeatInterval = setInterval(() => {
        if (closed) {
          clearInterval(heartbeatInterval);
          return;
        }
        send(createEvent('heartbeat:ping', {
          timestamp: new Date().toISOString(),
        }));
      }, 15000); // Every 15 seconds

      // Main polling loop
      const poll = async () => {
        if (closed) return;

        try {
          // Poll activities if subscribed
          if (subscriptions.has(CHANNELS.ACTIVITIES)) {
            const result = getActivities({ limit: 20, sort: 'newest' });
            const activities = result.activities;

            if (activities.length > 0) {
              const newest = activities[0];

              if (lastActivityId === null) {
                // First run: send recent batch
                send({
                  type: 'batch',
                  activities: activities.slice(0, 5),
                  timestamp: new Date().toISOString(),
                });
                lastActivityId = newest.id;
              } else if (newest.id !== lastActivityId) {
                // Find new activities
                const lastIdx = activities.findIndex(a => a.id === lastActivityId);
                const newActivities = lastIdx === -1 
                  ? activities 
                  : activities.slice(0, lastIdx);

                for (const activity of newActivities.reverse()) {
                  send(createEvent('activity:new', {
                    id: activity.id,
                    type: activity.type,
                    description: activity.description,
                    timestamp: activity.timestamp,
                    status: activity.status,
                    duration: activity.duration_ms ?? undefined,
                    tokens_used: activity.tokens_used ?? undefined,
                  }));
                }
                lastActivityId = newest.id;
              }
            }
          }

          // Reset backoff on success
          pollAttempt = 0;
        } catch (error) {
          pollAttempt++;
          console.error('[realtime] Poll error:', error);
        }

        // Schedule next poll with adaptive interval
        if (!closed) {
          const interval = pollAttempt > 0 ? getBackoffMs(pollAttempt) : 2000;
          setTimeout(poll, interval);
        }
      };

      poll();

      // Cleanup on disconnect
      request.signal?.addEventListener('abort', () => {
        closed = true;
        clearInterval(heartbeatInterval);
        clientSubscriptions.delete(clientId);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Client-Id': clientId,
    },
  });
}

// Handle channel subscriptions via POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, action, channels } = body as {
      clientId: string;
      action: 'subscribe' | 'unsubscribe';
      channels: string[];
    };

    if (!clientId || !clientSubscriptions.has(clientId)) {
      return Response.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const subs = clientSubscriptions.get(clientId)!;
    const validChannels = channels.filter(c => 
      Object.values(CHANNELS).includes(c as ChannelName)
    ) as ChannelName[];

    if (action === 'subscribe') {
      validChannels.forEach(c => subs.add(c));
    } else {
      validChannels.forEach(c => subs.delete(c));
    }

    return Response.json({ 
      success: true, 
      subscriptions: Array.from(subs) 
    });
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
