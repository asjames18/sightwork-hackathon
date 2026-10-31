/** rateLimit.check input guard: a blank or non-string key, or a
 * non-finite clock, throws a named rateLimit error instead of
 * silently sharing a bucket or answering a NaN retryAfterSec — the
 * same named-error rule the createRateLimiter config checks already
 * follow. Valid checks, limit enforcement, and window reset are
 * unchanged. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "@/lib/pipeline/rateLimit";

describe("rateLimit.check input guard", () => {
  test("blank, null, and non-string keys throw a named rateLimit error", () => {
    const limiter = createRateLimiter(30, 60_000);
    assert.throws(
      () => (limiter.check as (k: unknown) => unknown)(""),
      /rateLimit: key must be a non-empty string/,
    );
    assert.throws(
      () => (limiter.check as (k: unknown) => unknown)("   "),
      /rateLimit: key must be a non-empty string/,
    );
    assert.throws(
      () => (limiter.check as (k: unknown) => unknown)(null),
      /rateLimit: key must be a non-empty string/,
    );
    assert.throws(
      () => (limiter.check as (k: unknown) => unknown)(123),
      /rateLimit: key must be a non-empty string/,
    );
  });

  test("NaN and Infinity clocks throw a named rateLimit error", () => {
    const limiter = createRateLimiter(30, 60_000);
    assert.throws(
      () => limiter.check("1.2.3.4", Number.NaN),
      /rateLimit: nowMs must be a finite number/,
    );
    assert.throws(
      () => limiter.check("1.2.3.4", Number.POSITIVE_INFINITY),
      /rateLimit: nowMs must be a finite number/,
    );
  });

  test("valid checks still allow, enforce the limit, and reset after the window", () => {
    const limiter = createRateLimiter(2, 1000);
    assert.deepEqual(limiter.check("1.2.3.4", 0), { allowed: true, retryAfterSec: 0 });
    assert.deepEqual(limiter.check("1.2.3.4", 0), { allowed: true, retryAfterSec: 0 });
    assert.deepEqual(limiter.check("1.2.3.4", 0), { allowed: false, retryAfterSec: 1 });
    assert.deepEqual(limiter.check("1.2.3.4", 1000), { allowed: true, retryAfterSec: 0 });
  });
});
