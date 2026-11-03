/**
 * Per-IP rate limit for the paid API routes (/api/plan, /api/transcribe).
 *
 * Why it exists: every validated plan/transcribe request can spend model
 * money (the $10 spike cap in usage.ts is per request, not per IP), so
 * without a brake one IP could hammer the routes with paid runs. This
 * is a per-instance brake, not a billing guarantee: serverless
 * instances each hold their own bucket map, so a distributed flood
 * still gets through — but the trivial single-IP hammer does not.
 *
 * Placement rule (see the routes): the check runs after request
 * validation and after the transcribe route's free empty-audio return,
 * so only requests that would actually spend money count against the
 * bucket. Cheap rejects (400/413) and free calls never count.
 *
 * The bucket is a fixed window: `limit` requests per `windowMs` per
 * key, counted from the first request in the window. A blocked caller
 * gets retryAfterSec so the route can answer 429 with Retry-After.
 * The clock is injectable (nowMs) so tests can advance time without
 * waiting out a window. No API calls, no keys, no provider text.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets; 0 when allowed. */
  retryAfterSec: number;
}

export interface RateLimiter {
  check(key: string, nowMs?: number): RateLimitResult;
}

/** Default brake for a paid route: 30 spending requests per IP per 10 minutes. */
export const RATE_LIMIT_REQUESTS = 30;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/**
 * One limiter instance per route (each route file holds its own, so
 * plan and transcribe buckets are separate). Throws on a nonsense
 * config instead of silently running unlimited.
 */
export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`rateLimit: limit must be a whole number >= 1, got ${limit}`);
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error(`rateLimit: windowMs must be > 0, got ${windowMs}`);
  }
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key: string, nowMs: number = Date.now()): RateLimitResult {
      // A blank or non-string key would otherwise share one bucket
      // across every caller that passed it (the same failure mode as
      // the "unknown" fallback, but silent), and a non-finite clock
      // would mint a bucket that never expires and answer a NaN
      // retryAfterSec. Reject both here with a named error, the same
      // named-error rule the createRateLimiter config checks above
      // already follow. Valid route callers are unchanged: clientIp
      // always returns a non-empty string and the default clock is
      // Date.now().
      if (typeof key !== "string" || key.trim().length === 0) {
        throw new Error(`rateLimit: key must be a non-empty string, got ${JSON.stringify(key)}`);
      }
      if (!Number.isFinite(nowMs)) {
        throw new Error(`rateLimit: nowMs must be a finite number, got ${nowMs}`);
      }
      // Prune expired buckets on each check so the map cannot grow
      // without bound from one-off IPs.
      for (const [k, b] of buckets) {
        if (nowMs >= b.resetAt) buckets.delete(k);
      }
      let bucket = buckets.get(key);
      if (bucket === undefined) {
        bucket = { count: 0, resetAt: nowMs + windowMs };
        buckets.set(key, bucket);
      }
      if (bucket.count < limit) {
        bucket.count += 1;
        return { allowed: true, retryAfterSec: 0 };
      }
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - nowMs) / 1000)),
      };
    },
  };
}

/**
 * The caller IP for rate limiting: the first entry of x-forwarded-for
 * (the client, not the last proxy), else x-real-ip, else "unknown".
 * Vercel always sets x-forwarded-for, so "unknown" is only a fallback
 * bucket for non-Vercel hosts, shared across headerless callers.
 */
export function clientIp(req: Request): string {
  // A null, non-object, or headerless request would otherwise throw
  // a raw TypeError reading .headers or .get, surfacing internals
  // instead of the caller and the cause — the same named-error rule
  // the check() guard above already follows. Reject it here, before
  // any header is read. Valid route callers are unchanged: a real
  // Request always carries headers.get.
  const headers = (
    req as unknown as { headers?: { get?: unknown } } | null | undefined
  )?.headers;
  if (
    typeof headers !== "object" ||
    headers === null ||
    typeof headers.get !== "function"
  ) {
    throw new Error(`rateLimit: request must have headers, got ${JSON.stringify(req)}`);
  }
  const getHeader = (headers as { get: (name: string) => string | null }).get;
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = getHeader("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}
