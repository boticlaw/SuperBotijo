import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCache, createAsyncCache } from "./cache";

describe("createCache (sync)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns computed value on first call", () => {
    const compute = vi.fn(() => 42);
    const cache = createCache({ ttlMs: 1000, compute });

    expect(cache.get()).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("returns cached value on subsequent calls within TTL", () => {
    const compute = vi.fn(() => "hello");
    const cache = createCache({ ttlMs: 5000, compute });

    cache.get();
    cache.get();
    cache.get();

    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("recomputes after TTL expires", () => {
    let counter = 0;
    const compute = vi.fn(() => ++counter);
    const cache = createCache({ ttlMs: 1000, compute });

    expect(cache.get()).toBe(1);
    expect(compute).toHaveBeenCalledTimes(1);

    // Advance time past TTL
    vi.advanceTimersByTime(1001);

    expect(cache.get()).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("invalidate() forces recomputation on next call", () => {
    let counter = 0;
    const compute = vi.fn(() => ++counter);
    const cache = createCache({ ttlMs: 60_000, compute });

    expect(cache.get()).toBe(1);
    cache.invalidate();
    expect(cache.get()).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("lastUpdated() returns null before first computation", () => {
    const cache = createCache({ ttlMs: 1000, compute: () => "val" });

    expect(cache.lastUpdated()).toBeNull();
  });

  it("lastUpdated() returns correct timestamp after computation", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00Z"));
    const cache = createCache({ ttlMs: 1000, compute: () => "val" });

    cache.get();

    expect(cache.lastUpdated()).toBe(new Date("2026-03-15T10:00:00Z").getTime());
  });

  it("lastUpdated() updates after recomputation", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00Z"));
    const cache = createCache({ ttlMs: 1000, compute: () => "val" });

    cache.get();
    const firstUpdate = cache.lastUpdated();

    vi.advanceTimersByTime(2000);
    cache.get();
    const secondUpdate = cache.lastUpdated();

    expect(secondUpdate).toBeGreaterThan(firstUpdate!);
  });

  it("lastUpdated() resets to null after invalidate()", () => {
    const cache = createCache({ ttlMs: 1000, compute: () => "val" });

    cache.get();
    expect(cache.lastUpdated()).not.toBeNull();

    cache.invalidate();
    expect(cache.lastUpdated()).toBeNull();
  });

  it("does not cache errors from compute function", () => {
    let shouldThrow = true;
    const compute = vi.fn(() => {
      if (shouldThrow) throw new Error("boom");
      return "ok";
    });
    const cache = createCache({ ttlMs: 60_000, compute });

    expect(() => cache.get()).toThrow("boom");

    // Next call should retry (not return cached error)
    shouldThrow = false;
    expect(cache.get()).toBe("ok");
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

describe("createAsyncCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns computed value on first call", async () => {
    const compute = vi.fn(async () => "async-value");
    const cache = createAsyncCache({ ttlMs: 5000, compute });

    const result = await cache.get();

    expect(result).toBe("async-value");
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("returns cached value within TTL", async () => {
    const compute = vi.fn(async () => "cached");
    const cache = createAsyncCache({ ttlMs: 5000, compute });

    await cache.get();
    const result = await cache.get();

    expect(result).toBe("cached");
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("recomputes after TTL expires", async () => {
    let counter = 0;
    const compute = vi.fn(async () => ++counter);
    const cache = createAsyncCache({ ttlMs: 1000, compute });

    expect(await cache.get()).toBe(1);

    vi.advanceTimersByTime(1001);

    expect(await cache.get()).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent calls into a single compute invocation", async () => {
    const compute = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("shared"), 100))
    );
    const cache = createAsyncCache({ ttlMs: 5000, compute });

    // Fire 3 concurrent get() calls
    const p1 = cache.get();
    const p2 = cache.get();
    const p3 = cache.get();

    // Advance time so the setTimeout inside compute resolves
    vi.advanceTimersByTime(100);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toBe("shared");
    expect(r2).toBe("shared");
    expect(r3).toBe("shared");
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("does not cache errors — next call retries fresh", async () => {
    let callCount = 0;
    const compute = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error("transient failure");
      return "recovered";
    });
    const cache = createAsyncCache({ ttlMs: 5000, compute });

    // First call fails
    await expect(cache.get()).rejects.toThrow("transient failure");

    // Second call retries and succeeds
    const result = await cache.get();
    expect(result).toBe("recovered");
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("propagates error to all concurrent callers on failure", async () => {
    const compute = vi.fn(
      () => new Promise<string>((_, reject) => setTimeout(() => reject(new Error("all-fail")), 50))
    );
    const cache = createAsyncCache({ ttlMs: 5000, compute });

    const p1 = cache.get();
    const p2 = cache.get();

    vi.advanceTimersByTime(50);

    await expect(p1).rejects.toThrow("all-fail");
    await expect(p2).rejects.toThrow("all-fail");
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("retries after error propagated to concurrent callers", async () => {
    let callCount = 0;
    const compute = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("first-fail")), 50)
        );
      }
      return Promise.resolve("second-ok");
    });
    const cache = createAsyncCache({ ttlMs: 5000, compute });

    const p1 = cache.get();
    vi.advanceTimersByTime(50);
    await expect(p1).rejects.toThrow("first-fail");

    // Next call should retry
    const result = await cache.get();
    expect(result).toBe("second-ok");
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("invalidate() forces recomputation on next call", async () => {
    let counter = 0;
    const compute = vi.fn(async () => ++counter);
    const cache = createAsyncCache({ ttlMs: 60_000, compute });

    expect(await cache.get()).toBe(1);

    cache.invalidate();

    expect(await cache.get()).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("lastUpdated() returns null before first computation", () => {
    const cache = createAsyncCache({ ttlMs: 1000, compute: async () => "val" });

    expect(cache.lastUpdated()).toBeNull();
  });

  it("lastUpdated() returns timestamp after successful computation", async () => {
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
    const cache = createAsyncCache({ ttlMs: 5000, compute: async () => "val" });

    await cache.get();

    expect(cache.lastUpdated()).toBe(new Date("2026-03-15T12:00:00Z").getTime());
  });

  it("lastUpdated() does not update on failed computation", async () => {
    const compute = vi.fn(async () => {
      throw new Error("fail");
    });
    const cache = createAsyncCache({ ttlMs: 5000, compute });

    await expect(cache.get()).rejects.toThrow("fail");

    expect(cache.lastUpdated()).toBeNull();
  });
});
