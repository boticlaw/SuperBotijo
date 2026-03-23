/**
 * useRealtime Hook - WebSocket-like bidirectional communication
 * 
 * Provides a unified interface for real-time updates using SSE
 * with automatic reconnection, backoff, and action dispatching.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  type ServerEventMap,
  type ClientEventType,
  type ChannelName,
  CHANNELS,
  type RealtimeEvent,
  type ActivityNewPayload,
  type NotificationPayload,
} from "@/lib/realtime-events";

interface UseRealtimeOptions {
  enabled?: boolean;
  channels?: ChannelName[];
  onEvent?: <K extends keyof ServerEventMap>(
    type: K,
    payload: ServerEventMap[K]
  ) => void;
  onConnect?: (clientId: string) => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

interface RealtimeState {
  isConnected: boolean;
  isReconnecting: boolean;
  clientId: string | null;
  error: string | null;
  reconnectAttempt: number;
  latency: number | null;
}

interface SendActionOptions {
  timeout?: number;
}

interface UseRealtimeReturn extends RealtimeState {
  subscribe: (channels: ChannelName[]) => Promise<void>;
  unsubscribe: (channels: ChannelName[]) => Promise<void>;
  sendAction: <T = unknown>(
    type: ClientEventType,
    payload: unknown,
    options?: SendActionOptions
  ) => Promise<{ success: boolean; result?: T; error?: string }>;
  reconnect: () => void;
  disconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const {
    enabled = true,
    channels = [CHANNELS.ACTIVITIES, CHANNELS.AGENTS, CHANNELS.NOTIFICATIONS],
    onEvent,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    isReconnecting: false,
    clientId: null,
    error: null,
    reconnectAttempt: 0,
    latency: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isConnected: false,
      isReconnecting: false,
      clientId: null,
    }));
  }, []);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    const channelsParam = channels.join(',');
    const eventSource = new EventSource(`/api/realtime?channels=${encodeURIComponent(channelsParam)}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isReconnecting: false,
        error: null,
        reconnectAttempt: 0,
      }));
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeEvent;

        // Handle special events
        if (data.type === 'connected') {
          const payload = data.payload as { clientId: string; serverTime: string };
          setState(prev => ({
            ...prev,
            clientId: payload.clientId,
          }));
          onConnect?.(payload.clientId);
          return;
        }

        if (data.type === 'heartbeat:ping') {
          const now = Date.now();
          const latency = now - lastHeartbeatRef.current;
          lastHeartbeatRef.current = now;
          setState(prev => ({
            ...prev,
            latency: latency > 0 && latency < 60000 ? latency : prev.latency,
          }));
          return;
        }

        // Dispatch to handler
        if (onEvent && true) {
          // Type assertion needed due to dynamic event dispatch
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onEvent(data.type as keyof ServerEventMap, data.payload as any);
        }
      } catch (err) {
        console.error('[useRealtime] Parse error:', err);
      }
    };

    eventSource.onerror = () => {
      const wasConnected = state.isConnected;
      
      eventSource.close();
      eventSourceRef.current = null;

      setState(prev => {
        const newAttempt = prev.reconnectAttempt + 1;
        
        if (newAttempt >= MAX_RECONNECT_ATTEMPTS) {
          onError?.('Max reconnection attempts reached');
          return {
            ...prev,
            isConnected: false,
            isReconnecting: false,
            error: 'Connection failed',
          };
        }

        // Schedule reconnect with exponential backoff
        const delay = BASE_RECONNECT_DELAY * Math.pow(2, Math.min(newAttempt, 6));
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);

        return {
          ...prev,
          isConnected: false,
          isReconnecting: true,
          error: 'Reconnecting...',
          reconnectAttempt: newAttempt,
        };
      });

        if (wasConnected) {
          onDisconnect?.();
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, channels.join(','), onEvent, onConnect, onDisconnect, onError, state.isConnected]);

  const subscribe = useCallback(async (newChannels: ChannelName[]) => {
    if (!state.clientId) return;

    try {
      await fetch('/api/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: state.clientId,
          action: 'subscribe',
          channels: newChannels,
        }),
      });
    } catch (err) {
      console.error('[useRealtime] Subscribe error:', err);
    }
  }, [state.clientId]);

  const unsubscribe = useCallback(async (removeChannels: ChannelName[]) => {
    if (!state.clientId) return;

    try {
      await fetch('/api/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: state.clientId,
          action: 'unsubscribe',
          channels: removeChannels,
        }),
      });
    } catch (err) {
      console.error('[useRealtime] Unsubscribe error:', err);
    }
  }, [state.clientId]);

  const sendAction = useCallback(async <T = unknown,>(
    type: ClientEventType,
    payload: unknown,
    actionOptions?: SendActionOptions
  ): Promise<{ success: boolean; result?: T; error?: string }> => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const timeout = actionOptions?.timeout || 10000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('/api/realtime/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload, requestId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Action failed' };
      }

      return { success: true, result: data.result as T };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    sendAction,
    reconnect: () => {
      disconnect();
      setState(prev => ({ ...prev, reconnectAttempt: 0 }));
      connect();
    },
    disconnect,
  };
}

// Export a simpler hook for just activities
export function useRealtimeActivities(
  onNewActivity?: (activity: ActivityNewPayload) => void
) {
  return useRealtime({
    channels: [CHANNELS.ACTIVITIES],
    onEvent: (type, payload) => {
      if (type === "activity:new" && onNewActivity) {
        onNewActivity(payload as ActivityNewPayload);
      }
    },
  });
}

// Export a hook for notifications
export function useRealtimeNotifications(
  onNewNotification?: (notification: NotificationPayload) => void
) {
  return useRealtime({
    channels: [CHANNELS.NOTIFICATIONS],
    onEvent: (type, payload) => {
      if (type === "notification:new" && onNewNotification) {
        onNewNotification(payload as NotificationPayload);
      }
    },
  });
}
