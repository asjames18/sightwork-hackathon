/** planBodyTooLarge guard (src/lib/pipeline/planRequest.ts): a
 * non-string body from a direct caller used to be silently coerced
 * by TextEncoder.encode, so an object became "[object Object]"
 * (15 bytes) and passed the cap. Such a body now throws a named
 * planRequest error, while string bodies are still measured by
 * bytes and the route caller (req.text(), always a string) is
 * unchanged. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MAX_PLAN_BODY_BYTES, planBodyTooLarge } from "@/lib/pipeline/planRequest";

describe("planBodyTooLarge text guard", () => {
  test("non-string bodies throw a named planRequest error", () => {
    for (const bad of [null, undefined, 10, {}, []] as unknown[]) {
      assert.throws(
        () => planBodyTooLarge(bad as string),
        /planRequest: bodyText must be a string/,
      );
    }
  });

  test("string bodies are still measured by bytes against the cap", () => {
    assert.equal(planBodyTooLarge("x"), false);
    assert.equal(planBodyTooLarge("x".repeat(MAX_PLAN_BODY_BYTES)), false);
    assert.equal(planBodyTooLarge("x".repeat(MAX_PLAN_BODY_BYTES + 1)), true);
  });
});
