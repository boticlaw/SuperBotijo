// Runtime Event Bridge - Type-safe event system for component communication

import type { RuntimeEvent, EventHandler, EventFilter, EventType } from "@/types/events";

class EventBridge {
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();
  private eventHistory: RuntimeEvent[] = [];
  private maxHistorySize = 100;

  /**
   * Subscribe to specific event types
   */
  subscribe<T extends RuntimeEvent>(
    eventType: T["type"],
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler);
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Subscribe with filter
   */
  subscribeWithFilter(
    filter: EventFilter,
    handler: EventHandler
  ): () => void {
    const filteredHandler: EventHandler = (event) => {
      // Check type filter
      if (filter.types && !filter.types.includes(event.type)) {
        return;
      }
      
      // Check source filter
      if (filter.source && event.source !== filter.source) {
        return;
      }
      
      handler(event);
    };

    return this.subscribeAll(filteredHandler);
  }

  /**
   * Emit an event
   */
  emit<T extends RuntimeEvent>(event: T): void {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify specific handlers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      });
    }

    // Notify global handlers
    this.globalHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in global event handler:`, error);
      }
    });
  }

  /**
   * Get event history
   */
  getHistory(filter?: EventFilter): RuntimeEvent[] {
    if (!filter) {
      return [...this.eventHistory];
    }

    return this.eventHistory.filter((event) => {
      if (filter.types && !filter.types.includes(event.type)) {
        return false;
      }
      if (filter.source && event.source !== filter.source) {
        return false;
      }
      return true;
    });
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Remove all handlers
   */
  clearAllHandlers(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
  }
}

// Singleton instance
export const eventBridge = new EventBridge();

// Helper functions for common events
export const emitActivityUpdate = (activityId: string, status: "success" | "error" | "pending", updates: Record<string, unknown>) => {
  eventBridge.emit({
    type: "activity:update",
    timestamp: new Date().toISOString(),
    payload: { activityId, status, updates },
  });
};

export const emitSessionChange = (sessionKey: string, changes: Record<string, unknown>) => {
  eventBridge.emit({
    type: "session:change",
    timestamp: new Date().toISOString(),
    payload: { sessionKey, changes },
  });
};

export const emitNotification = (notificationId: string, title: string, body: string, priority: "low" | "medium" | "high" = "medium") => {
  eventBridge.emit({
    type: "notification:new",
    timestamp: new Date().toISOString(),
    payload: { notificationId, title, body, priority },
  });
};

export const emitGatewayStatus = (status: "connected" | "disconnected" | "error", latency?: number, port?: number) => {
  eventBridge.emit({
    type: "gateway:status",
    timestamp: new Date().toISOString(),
    payload: { status, latency, port },
  });
};

export const emitModelChange = (sessionKey: string, oldModel: string, newModel: string) => {
  eventBridge.emit({
    type: "model:change",
    timestamp: new Date().toISOString(),
    payload: { sessionKey, oldModel, newModel },
  });
};

// ============================================================================
// Kanban Event Emitters
// ============================================================================

export const emitKanbanTaskCreated = (taskId: string, title: string, status: string, priority: string) => {
  eventBridge.emit({
    type: "kanban:task_created",
    timestamp: new Date().toISOString(),
    payload: { taskId, title, status, priority },
  });
};

export const emitKanbanTaskUpdated = (taskId: string, title: string, changes: Record<string, unknown>) => {
  eventBridge.emit({
    type: "kanban:task_updated",
    timestamp: new Date().toISOString(),
    payload: { taskId, title, changes },
  });
};

export const emitKanbanTaskDeleted = (taskId: string, title: string) => {
  eventBridge.emit({
    type: "kanban:task_deleted",
    timestamp: new Date().toISOString(),
    payload: { taskId, title },
  });
};

export const emitKanbanTaskMoved = (taskId: string, title: string, fromColumn: string, toColumn: string) => {
  eventBridge.emit({
    type: "kanban:task_moved",
    timestamp: new Date().toISOString(),
    payload: { taskId, title, fromColumn, toColumn },
  });
};

export const emitKanbanColumnCreated = (columnId: string, name: string) => {
  eventBridge.emit({
    type: "kanban:column_created",
    timestamp: new Date().toISOString(),
    payload: { columnId, name },
  });
};

export const emitKanbanColumnUpdated = (columnId: string, name: string, changes: Record<string, unknown>) => {
  eventBridge.emit({
    type: "kanban:column_updated",
    timestamp: new Date().toISOString(),
    payload: { columnId, name, changes },
  });
};

export const emitKanbanColumnDeleted = (columnId: string, name: string) => {
  eventBridge.emit({
    type: "kanban:column_deleted",
    timestamp: new Date().toISOString(),
    payload: { columnId, name },
  });
};
