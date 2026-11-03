/** clientIp request guard (src/lib/pipeline/rateLimit.ts): a null,
 * non-object, or headerless request used to throw a raw TypeError
 * reading .headers or .get, surfacing internals instead of the caller
 * and the cause. Such requests now throw a named rateLimit error,
 * while valid requests still return the first forwarded IP, the
 * real IP, or "unknown". No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "@/lib/pipeline/rateLimit";

describe("clientIp request guard", () => {
  test("null, undefined, and non-object requests throw a named error", () => {
    for (const bad of [null, undefined, "1.2.3.4", 42]) {
      assert.throws(
        () => (clientIp as (x: unknown) => string)(bad),
        /rateLimit: request must have headers/,
      );
    }
  });

  test("a headerless object and headers without get throw a named error", () => {
    assert.throws(
      () => (clientIp as (x: unknown) => string)({}),
      /rateLimit: request must have headers/,
    );
    assert.throws(
      () => (clientIp as (x: unknown) => string)({ headers: {} }),
      /rateLimit: request must have headers/,
    );
  });

  test("a real Headers object works (detached get would throw Illegal invocation)", () => {
    const req = new Request("https://example.com/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    assert.equal(clientIp(req), "1.2.3.4");
    assert.equal(clientIp(new Request("https://example.com/")), "unknown");
  });

  test("valid requests still return forwarded, real, or unknown IP", () => {
    const forwarded = (clientIp as (x: unknown) => string)({
      headers: { get: (n: string) => (n === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null) },
    });
    assert.equal(forwarded, "1.2.3.4");
    const real = (clientIp as (x: unknown) => string)({
      headers: { get: (n: string) => (n === "x-real-ip" ? "9.9.9.9" : null) },
    });
    assert.equal(real, "9.9.9.9");
    const unknown = (clientIp as (x: unknown) => string)({
      headers: { get: () => null },
    });
    assert.equal(unknown, "unknown");
  });
});
