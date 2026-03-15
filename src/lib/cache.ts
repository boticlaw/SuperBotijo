/**
 * Generic TTL cache utilities with get-or-compute semantics.
 *
 * Provides two factories:
 * - `createCache<T>()` for synchronous compute functions
 * - `createAsyncCache<T>()` for async compute functions with concurrent call deduplication
 *
 * Both support TTL-based expiration, error non-poisoning, and manual invalidation.
 *
 * @module cache
 */

/**
 * Options for creating a cache instance.
 */
interface CacheOptions<T> {
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Function that computes the cached value */
  compute: () => T;
}

/**
 * Options for creating an async cache instance.
 */
interface AsyncCacheOptions<T> {
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Async function that computes the cached value */
  compute: () => Promise<T>;
}

/**
 * A cache instance with get-or-compute semantics.
 */
interface CacheInstance<T> {
  /** Get the cached value, recomputing if expired or missing */
  get: () => T;
  /** Clear the cached entry, forcing recomputation on next get() */
  invalidate: () => void;
  /** Epoch ms of the last successful computation, or null if never computed */
  lastUpdated: () => number | null;
}

/**
 * An async cache instance with get-or-compute semantics and concurrent call deduplication.
 */
interface AsyncCacheInstance<T> {
  /** Get the cached value, recomputing if expired or missing. Concurrent calls are deduplicated. */
  get: () => Promise<T>;
  /** Clear the cached entry, forcing recomputation on next get() */
  invalidate: () => void;
  /** Epoch ms of the last successful computation, or null if never computed */
  lastUpdated: () => number | null;
}

/**
 * Create a synchronous TTL cache.
 *
 * The compute function is invoked when:
 * - No cached value exists (first call)
 * - The cached value has expired (age >= TTL)
 * - The cache was manually invalidated
 *
 * Errors from the compute function are propagated to the caller and NOT cached.
 *
 * @param options - Cache configuration with TTL and compute function
 * @returns A cache instance with get() and invalidate() methods
 */
export function createCache<T>(options: CacheOptions<T>): CacheInstance<T> {
  const { ttlMs, compute } = options;

  let cachedValue: T | undefined;
  let cachedAt: number | null = null;

  function isValid(): boolean {
    if (cachedAt === null) return false;
    return (Date.now() - cachedAt) < ttlMs;
  }

  function get(): T {
    if (isValid()) {
      return cachedValue as T;
    }

    // Compute fresh value — errors propagate without caching
    const value = compute();
    cachedValue = value;
    cachedAt = Date.now();
    return value;
  }

  function invalidate(): void {
    cachedValue = undefined;
    cachedAt = null;
  }

  function lastUpdated(): number | null {
    return cachedAt;
  }

  return { get, invalidate, lastUpdated };
}

/**
 * Create an asynchronous TTL cache with concurrent call deduplication.
 *
 * The compute function is invoked when:
 * - No cached value exists (first call)
 * - The cached value has expired (age >= TTL)
 * - The cache was manually invalidated
 *
 * **Concurrent call deduplication (promise coalescing):** If multiple callers
 * invoke `get()` while a computation is in-flight, they all receive the same
 * Promise. This prevents redundant parallel computations.
 *
 * **Error non-poisoning:** If the compute function throws, the error is
 * propagated to ALL waiting callers, but the failed result is NOT cached.
 * The next `get()` call will retry the computation.
 *
 * @param options - Cache configuration with TTL and async compute function
 * @returns An async cache instance with get() and invalidate() methods
 */
export function createAsyncCache<T>(options: AsyncCacheOptions<T>): AsyncCacheInstance<T> {
  const { ttlMs, compute } = options;

  let cachedValue: T | undefined;
  let cachedAt: number | null = null;
  let inflight: Promise<T> | null = null;

  function isValid(): boolean {
    if (cachedAt === null) return false;
    return (Date.now() - cachedAt) < ttlMs;
  }

  async function get(): Promise<T> {
    // Return cached value if still valid
    if (isValid()) {
      return cachedValue as T;
    }

    // If a computation is already in-flight, coalesce onto it
    if (inflight !== null) {
      return inflight;
    }

    // Start a new computation
    inflight = compute()
      .then((value) => {
        cachedValue = value;
        cachedAt = Date.now();
        inflight = null;
        return value;
      })
      .catch((error: unknown) => {
        // Error non-poisoning: do NOT cache the failure
        inflight = null;
        throw error;
      });

    return inflight;
  }

  function invalidate(): void {
    cachedValue = undefined;
    cachedAt = null;
    // Do NOT cancel in-flight computations — they will resolve/reject naturally
  }

  function lastUpdated(): number | null {
    return cachedAt;
  }

  return { get, invalidate, lastUpdated };
}
