"use client";

import { useEffect, useCallback } from "react";
import { eventBridge } from "@/lib/runtime-events";
import type { RuntimeEvent, EventHandler, EventFilter } from "@/types/events";

/**
 * Hook to subscribe to events with automatic cleanup
 */
export function useEventSubscription<T extends RuntimeEvent>(
  eventType: T["type"],
  handler: EventHandler<T>
) {
  useEffect(() => {
    const unsubscribe = eventBridge.subscribe(eventType, handler);
    return unsubscribe;
  }, [eventType, handler]);
}

/**
 * Hook to subscribe to all events with automatic cleanup
 */
export function useAllEventsSubscription(handler: EventHandler) {
  useEffect(() => {
    const unsubscribe = eventBridge.subscribeAll(handler);
    return unsubscribe;
  }, [handler]);
}

/**
 * Hook to subscribe to events with filter
 */
export function useFilteredEvents(filter: EventFilter, handler: EventHandler) {
  useEffect(() => {
    const unsubscribe = eventBridge.subscribeWithFilter(filter, handler);
    return unsubscribe;
  }, [filter, handler]);
}

/**
 * Hook to emit events
 */
export function useEventEmitter() {
  return useCallback((event: RuntimeEvent) => {
    eventBridge.emit(event);
  }, []);
}

/**
 * Hook to access event history
 */
export function useEventHistory(filter?: EventFilter) {
  return eventBridge.getHistory(filter);
}
