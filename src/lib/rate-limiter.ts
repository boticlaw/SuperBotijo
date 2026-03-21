interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class SlidingWindowRateLimiter {
  private store: Map<string, RateLimitEntry>;
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.store = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry) {
      this.store.set(identifier, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetIn: this.windowMs,
      };
    }

    if (now - entry.windowStart >= this.windowMs) {
      this.store.set(identifier, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetIn: this.windowMs,
      };
    }

    if (entry.count >= this.maxRequests) {
      const resetIn = this.windowMs - (now - entry.windowStart);
      return {
        allowed: false,
        remaining: 0,
        resetIn,
      };
    }

    entry.count++;
    const remaining = this.maxRequests - entry.count;
    const resetIn = this.windowMs - (now - entry.windowStart);

    return {
      allowed: true,
      remaining,
      resetIn,
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart >= this.windowMs) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimiter = new SlidingWindowRateLimiter(60 * 1000, 10);

export { SlidingWindowRateLimiter, rateLimiter };
