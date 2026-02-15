/**
 * In-memory rate limiter for 402 intent creation. Tracks count per key (e.g. IP) in a sliding window.
 */

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;
const CLEANUP_INTERVAL_MS = 60_000;

type Entry = { count: number; windowStart: number };

let store = new Map<string, Entry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupTimer != null) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart >= DEFAULT_WINDOW_MS) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
}

export type RateLimitConfig = {
  intentRateLimit?: number;
  intentRateWindowMs?: number;
};

export type RateLimitResult = { allowed: boolean; retryAfter?: number };

/**
 * Check if the key (e.g. IP or IP+path) is within rate limit. Default 60 intents per minute per key.
 */
export function checkRateLimit(
  key: string,
  config?: RateLimitConfig
): RateLimitResult {
  const limit = config?.intentRateLimit ?? DEFAULT_LIMIT;
  const windowMs = config?.intentRateWindowMs ?? DEFAULT_WINDOW_MS;
  ensureCleanup();

  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > limit) {
    const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfterSec) };
  }
  return { allowed: true };
}

export function getRateLimitKey(req: { headers?: Record<string, string> }): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  const ip = forwarded ? String(forwarded).split(",")[0].trim() : req.headers?.["x-real-ip"] ?? "unknown";
  return ip;
}
