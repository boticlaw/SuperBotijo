/**
 * Realtime Action Endpoint
 * POST /api/realtime/action
 * 
 * Handles client-to-server actions for bidirectional communication.
 * This enables WebSocket-like interactions over HTTP POST.
 */
import { NextRequest } from 'next/server';
import { 
  type ClientEventType,
  type ActionApprovePayload,
  type ActionRejectPayload,
  type AgentControlPayload,
} from '@/lib/realtime-events';
import { getActivities, updateActivityStatus } from '@/lib/activities-db';

interface RealtimeAction {
  type: ClientEventType;
  payload: unknown;
  requestId?: string;
}

// Simple in-memory action queue (for demo; in production use Redis/Bull)
const actionResults = new Map<string, { status: 'success' | 'error'; result?: unknown; error?: string }>();

export async function POST(request: NextRequest) {
  try {
    const action: RealtimeAction = await request.json();
    const { type, payload, requestId } = action;

    let result: unknown;
    let error: string | null = null;

    switch (type) {
      case 'ping': {
        result = { pong: true, timestamp: new Date().toISOString() };
        break;
      }

      case 'action:approve': {
        const { activityId, notes } = payload as ActionApprovePayload;
        // Update activity status to approved
        const activities = getActivities({ limit: 100 });
        const activity = activities.activities.find(a => a.id === activityId);
        if (activity) {
          updateActivityStatus(activityId, 'approved');
          result = { 
            success: true, 
            activityId, 
            approved: true,
            notes,
            timestamp: new Date().toISOString(),
          };
        } else {
          error = 'Activity not found';
        }
        break;
      }

      case 'action:reject': {
        const { activityId, reason } = payload as ActionRejectPayload;
        const activities = getActivities({ limit: 100 });
        const activity = activities.activities.find(a => a.id === activityId);
        if (activity) {
          updateActivityStatus(activityId, 'rejected');
          result = { 
            success: true, 
            activityId, 
            rejected: true,
            reason,
            timestamp: new Date().toISOString(),
          };
        } else {
          error = 'Activity not found';
        }
        break;
      }

      case 'agent:pause': {
        const { agentId } = payload as AgentControlPayload;
        // In production, this would signal the actual agent process
        result = { 
          success: true, 
          agentId, 
          paused: true,
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'agent:resume': {
        const { agentId } = payload as AgentControlPayload;
        result = { 
          success: true, 
          agentId, 
          resumed: true,
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'session:cancel': {
        const { sessionId } = payload as { sessionId: string };
        // In production, this would cancel the running session
        result = { 
          success: true, 
          sessionId, 
          cancelled: true,
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'subscribe':
      case 'unsubscribe': {
        // These are handled by the main realtime endpoint
        result = { 
          success: true, 
          message: 'Use the main realtime endpoint for subscriptions' 
        };
        break;
      }

      default: {
        error = `Unknown action type: ${type}`;
      }
    }

    // Store result for potential polling
    if (requestId) {
      actionResults.set(requestId, {
        status: error ? 'error' : 'success',
        result,
        error: error || undefined,
      });
      // Clean up old results after 5 minutes
      setTimeout(() => actionResults.delete(requestId), 5 * 60 * 1000);
    }

    if (error) {
      return Response.json({ error, requestId }, { status: 400 });
    }

    return Response.json({ success: true, result, requestId });
  } catch (err) {
    console.error('[realtime/action] Error:', err);
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// GET to check action result (for polling-based clients)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestId = url.searchParams.get('requestId');

  if (!requestId) {
    return Response.json({ error: 'requestId required' }, { status: 400 });
  }

  const result = actionResults.get(requestId);
  if (!result) {
    return Response.json({ status: 'pending' });
  }

  return Response.json(result);
}
