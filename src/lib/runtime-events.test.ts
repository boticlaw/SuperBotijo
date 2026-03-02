import { describe, it, expect, beforeEach, vi } from "vitest";
import { eventBridge, emitActivityUpdate, emitSessionChange, emitNotification, emitGatewayStatus, emitModelChange } from "./runtime-events";
import type { RuntimeEvent, EventHandler, EventFilter } from "@/types/events";

describe("runtime-events", () => {
  // Reset event bridge before each test
  beforeEach(() => {
    eventBridge.clearHistory();
    eventBridge.clearAllHandlers();
  });

  describe("EventBridge", () => {
    it("should subscribe and receive events", () => {
      const handler = vi.fn();
      eventBridge.subscribe("activity:update", handler);

      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: {
          activityId: "test-1",
          status: "success",
          updates: {},
        },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "activity:update",
          payload: expect.objectContaining({
            activityId: "test-1",
            status: "success",
          }),
        })
      );
    });

    it("should return unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = eventBridge.subscribe("activity:update", handler);

      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: { activityId: "1", status: "success", updates: {} },
      });

      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: { activityId: "2", status: "success", updates: {} },
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should support subscribeAll for all events", () => {
      const handler = vi.fn();
      eventBridge.subscribeAll(handler);

      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: { activityId: "1", status: "success", updates: {} },
      });

      eventBridge.emit({
        type: "session:change",
        timestamp: new Date().toISOString(),
        payload: { sessionKey: "s1", changes: {} },
      });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should support subscribeWithFilter by type", () => {
      const handler = vi.fn();
      eventBridge.subscribeWithFilter({ types: ["activity:update"] }, handler);

      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: { activityId: "1", status: "success", updates: {} },
      });

      eventBridge.emit({
        type: "session:change",
        timestamp: new Date().toISOString(),
        payload: { sessionKey: "s1", changes: {} },
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should support subscribeWithFilter by source", () => {
      const handler = vi.fn();
      eventBridge.subscribeWithFilter({ source: "test-source" }, handler);

      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        source: "test-source",
        payload: { activityId: "1", status: "success", updates: {} },
      });

      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        source: "other-source",
        payload: { activityId: "2", status: "success", updates: {} },
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should add timestamp if not present", () => {
      const handler = vi.fn<[RuntimeEvent]>();
      eventBridge.subscribe("activity:update", handler);

      eventBridge.emit({
        type: "activity:update",
        // No timestamp
        payload: { activityId: "1", status: "success", updates: {} },
      } as RuntimeEvent);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });

    it("should limit history to 100 events", () => {
      const handler = vi.fn();
      eventBridge.subscribe("activity:update", handler);

      // Emit 150 events
      for (let i = 0; i < 150; i++) {
        eventBridge.emit({
          type: "activity:update",
          timestamp: new Date().toISOString(),
          payload: { activityId: String(i), status: "success", updates: {} },
        });
      }

      const history = eventBridge.getHistory();
      expect(history.length).toBe(100);
    });

    it("should getHistory without filter", () => {
      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: { activityId: "1", status: "success", updates: {} },
      });

      const history = eventBridge.getHistory();
      expect(history.length).toBe(1);
    });

    it("should getHistory with type filter", () => {
      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: { activityId: "1", status: "success", updates: {} },
      });

      eventBridge.emit({
        type: "session:change",
        timestamp: new Date().toISOString(),
        payload: { sessionKey: "s1", changes: {} },
      });

      const history = eventBridge.getHistory({ types: ["activity:update"] });
      expect(history.length).toBe(1);
      expect(history[0].type).toBe("activity:update");
    });

    it("should getHistory with source filter", () => {
      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        source: "test-source",
        payload: { activityId: "1", status: "success", updates: {} },
      });

      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        source: "other",
        payload: { activityId: "2", status: "success", updates: {} },
      });

      const history = eventBridge.getHistory({ source: "test-source" });
      expect(history.length).toBe(1);
      expect(history[0].source).toBe("test-source");
    });

    it("should clear history", () => {
      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: { activityId: "1", status: "success", updates: {} },
      });

      eventBridge.clearHistory();

      const history = eventBridge.getHistory();
      expect(history.length).toBe(0);
    });

    it("should clear all handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBridge.subscribe("activity:update", handler1);
      eventBridge.subscribeAll(handler2);

      eventBridge.clearAllHandlers();

      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: { activityId: "1", status: "success", updates: {} },
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should handle errors in handlers gracefully", () => {
      const errorHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      const normalHandler = vi.fn();

      eventBridge.subscribe("activity:update", errorHandler);
      eventBridge.subscribe("activity:update", normalHandler);

      // Should not throw
      eventBridge.emit({
        type: "activity:update",
        timestamp: new Date().toISOString(),
        payload: { activityId: "1", status: "success", updates: {} },
      });

      // Normal handler should still be called
      expect(normalHandler).toHaveBeenCalled();
    });
  });

  describe("Helper functions", () => {
    it("emitActivityUpdate should work", () => {
      const handler = vi.fn();
      eventBridge.subscribe("activity:update", handler);

      emitActivityUpdate("test-123", "success", { duration: 1000 });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "activity:update",
          payload: expect.objectContaining({
            activityId: "test-123",
            status: "success",
            updates: { duration: 1000 },
          }),
        })
      );
    });

    it("emitSessionChange should work", () => {
      const handler = vi.fn();
      eventBridge.subscribe("session:change", handler);

      emitSessionChange("session-1", { model: "claude-3" });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session:change",
          payload: expect.objectContaining({
            sessionKey: "session-1",
            changes: { model: "claude-3" },
          }),
        })
      );
    });

    it("emitNotification should work with default priority", () => {
      const handler = vi.fn();
      eventBridge.subscribe("notification:new", handler);

      emitNotification("notif-1", "Test Title", "Test Body");

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "notification:new",
          payload: expect.objectContaining({
            notificationId: "notif-1",
            title: "Test Title",
            body: "Test Body",
            priority: "medium", // default
          }),
        })
      );
    });

    it("emitNotification should work with custom priority", () => {
      const handler = vi.fn();
      eventBridge.subscribe("notification:new", handler);

      emitNotification("notif-1", "Test", "Body", "high");

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            priority: "high",
          }),
        })
      );
    });

    it("emitGatewayStatus should work without optional params", () => {
      const handler = vi.fn();
      eventBridge.subscribe("gateway:status", handler);

      emitGatewayStatus("connected");

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "gateway:status",
          payload: expect.objectContaining({
            status: "connected",
          }),
        })
      );
    });

    it("emitGatewayStatus should work with latency and port", () => {
      const handler = vi.fn();
      eventBridge.subscribe("gateway:status", handler);

      emitGatewayStatus("connected", 50, 3000);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            status: "connected",
            latency: 50,
            port: 3000,
          }),
        })
      );
    });

    it("emitModelChange should work", () => {
      const handler = vi.fn();
      eventBridge.subscribe("model:change", handler);

      emitModelChange("session-1", "old-model", "new-model");

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "model:change",
          payload: expect.objectContaining({
            sessionKey: "session-1",
            oldModel: "old-model",
            newModel: "new-model",
          }),
        })
      );
    });
  });

  describe("Type safety", () => {
    it("should accept valid event types", () => {
      const handler = vi.fn();

      // These should compile without errors
      eventBridge.subscribe("activity:update", handler);
      eventBridge.subscribe("session:change", handler);
      eventBridge.subscribe("notification:new", handler);
      eventBridge.subscribe("gateway:status", handler);
      eventBridge.subscribe("model:change", handler);

      expect(eventBridge).toBeDefined();
    });
  });
});
