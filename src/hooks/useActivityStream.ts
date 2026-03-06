import { useEffect, useRef, useState, useCallback } from "react";

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: string;
  [key: string]: unknown;
}

interface UseActivityStreamOptions {
  enabled?: boolean;
  onActivity?: (activity: Activity) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface UseActivityStreamReturn {
  activities: Activity[];
  isConnected: boolean;
  error: string | null;
  clearActivities: () => void;
  reconnect: () => void;
  disconnect: () => void;
}

export function useActivityStream(options: UseActivityStreamOptions = {}): UseActivityStreamReturn {
  const { enabled = true, onActivity, onConnect, onDisconnect } = options;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Store callbacks in refs to avoid circular dependency
  const onActivityRef = useRef(onActivity);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Keep refs updated
  useEffect(() => {
    onActivityRef.current = onActivity;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onActivity, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    const eventSource = new EventSource("/api/activities/stream");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      onConnectRef.current?.();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          return;
        }

        if (data.type === "batch" && Array.isArray(data.activities)) {
          setActivities((prev) => {
            const existingIds = new Set(prev.map((a) => a.id));
            const newActivities = data.activities.filter((a: Activity) => !existingIds.has(a.id));
            return [...newActivities, ...prev].slice(0, 100);
          });
          return;
        }

    if (data.type === "new" && data.activity) {
       
      setActivities((prev) => {
        const exists = prev.some((a) => a.id === data.activity.id);
        if (exists) return prev;
        return [data.activity, ...prev].slice(0, 100);
      });
      onActivityRef.current?.(data.activity);
    }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError("Connection lost");
      onDisconnectRef.current?.();
      eventSource.close();
      eventSourceRef.current = null;

      reconnectTimeoutRef.current = setTimeout(() => {
        setError("Reconnecting...");
        // Reconnect by triggering a new connection
        if (enabled && !eventSourceRef.current) {
          const newEventSource = new EventSource("/api/activities/stream");
          eventSourceRef.current = newEventSource;
          
          newEventSource.onopen = () => {
            setIsConnected(true);
            setError(null);
            onConnectRef.current?.();
          };
          
          newEventSource.onmessage = eventSource.onmessage;
          newEventSource.onerror = eventSource.onerror;
        }
      }, 3000);
    };
  }, [enabled]);

  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    activities,
    isConnected,
    error,
    clearActivities,
    reconnect: connect,
    disconnect,
  };
}
