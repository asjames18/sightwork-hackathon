/** The tester-code gate in src/proxy.ts: real runs cost money, so /api/** must fail closed. */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy, config } from "@/proxy";

const ENV = "SIGHTWORK_TEST_CODE";
const saved = process.env[ENV];
afterEach(() => {
  if (saved === undefined) delete process.env[ENV];
  else process.env[ENV] = saved;
});

const req = (code?: string, method = "POST") =>
  new NextRequest("http://localhost/api/plan", { method, headers: code === undefined ? {} : { "x-sightwork-test-code": code } });
const quiet = <T>(fn: () => T): T => {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
};

test("only /api/** is gated", () => {
  assert.equal(config.matcher, "/api/:path*");
});

test("fails closed when the server has no code set", () => {
  delete process.env[ENV];
  for (const c of [undefined, "", "anything"]) assert.equal(proxy(req(c)).status, 401);
  process.env[ENV] = "   ";
  assert.equal(proxy(req("   ")).status, 401);
});

test("rejects a missing or wrong code, without caching", () => {
  process.env[ENV] = "right-code";
  for (const c of [undefined, "", "wrong", "right-cod", "right-code-x"]) {
    const res = proxy(req(c));
    assert.equal(res.status, 401, String(c));
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
});

test("lets the right code through (trimmed)", () => {
  process.env[ENV] = "right-code";
  const res = quiet(() => proxy(req("  right-code ")));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-middleware-next"), "1");
});
