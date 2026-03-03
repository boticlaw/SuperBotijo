import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { clearAllDataForTesting } from "@/lib/kanban-db";

describe("/api/kanban/stream", () => {
  beforeEach(() => {
    clearAllDataForTesting();
  });

  afterEach(() => {
    clearAllDataForTesting();
  });

  // Mock Request with abort signal
  function createMockRequest(): Request {
    const controller = new AbortController();
    return new Request("http://localhost/api/kanban/stream", {
      signal: controller.signal,
    });
  }

  it("returns a Response with correct headers", async () => {
    const request = createMockRequest();
    const response = await GET(request as unknown as Parameters<typeof GET>[0]);

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  it("returns a ReadableStream", async () => {
    const request = createMockRequest();
    const response = await GET(request as unknown as Parameters<typeof GET>[0]);

    expect(response.body).toBeInstanceOf(ReadableStream);
  });

  it("sends initial connected event", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/kanban/stream", {
      signal: controller.signal,
    });
    
    const response = await GET(request as unknown as Parameters<typeof GET>[0]);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("No reader available");
    }

    // Read first chunk
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    
    // Should contain a connected event
    expect(text).toContain("data:");
    expect(text).toContain("connected");

    // Cancel the stream
    controller.abort();
    reader.cancel();
  });

  it("sends initial state on first poll", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/kanban/stream", {
      signal: controller.signal,
    });
    
    const response = await GET(request as unknown as Parameters<typeof GET>[0]);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("No reader available");
    }

    // Read chunks until we get initial state or timeout
    let buffer = "";
    let foundInitial = false;
    
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += new TextDecoder().decode(value);
      
      if (buffer.includes('"type":"initial"')) {
        foundInitial = true;
        break;
      }
    }

    expect(foundInitial).toBe(true);

    // Cancel the stream
    controller.abort();
    reader.cancel();
  });

  it("includes tasksByColumn and columns in initial state", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/kanban/stream", {
      signal: controller.signal,
    });
    
    const response = await GET(request as unknown as Parameters<typeof GET>[0]);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("No reader available");
    }

    // Read chunks
    let buffer = "";
    
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += new TextDecoder().decode(value);
      
      if (buffer.includes('"type":"initial"')) {
        break;
      }
    }

    // Should include tasksByColumn and columns
    expect(buffer).toContain("tasksByColumn");
    expect(buffer).toContain("columns");

    // Cancel the stream
    controller.abort();
    reader.cancel();
  });

  it("handles abort signal gracefully", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/kanban/stream", {
      signal: controller.signal,
    });
    
    const response = await GET(request as unknown as Parameters<typeof GET>[0]);
    
    // Abort immediately
    controller.abort();
    
    // Response should still be created
    expect(response).toBeInstanceOf(Response);
  });

  it("sends events in SSE format", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/kanban/stream", {
      signal: controller.signal,
    });
    
    const response = await GET(request as unknown as Parameters<typeof GET>[0]);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("No reader available");
    }

    // Read first chunk
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    
    // SSE format: "data: {json}\n\n"
    expect(text).toMatch(/data:\s*\{.*\}\n\n/);

    // Cancel the stream
    controller.abort();
    reader.cancel();
  });

  it("includes timestamp in events", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/kanban/stream", {
      signal: controller.signal,
    });
    
    const response = await GET(request as unknown as Parameters<typeof GET>[0]);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("No reader available");
    }

    // Read first chunk
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    
    // Should contain a timestamp (ISO format)
    expect(text).toMatch(/"ts":"\d{4}-\d{2}-\d{2}T/);

    // Cancel the stream
    controller.abort();
    reader.cancel();
  });
});
