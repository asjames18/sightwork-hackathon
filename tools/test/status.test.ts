/** /status facts: presence only, never a value; real runs off without a tester code. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { siteStatus } from "@/lib/status";

const SECRET = "very-secret-value-123";

test("fully configured production: every row ok, Muse Spark Open on Baseten by default", () => {
  const s = siteStatus({ SIGHTWORK_TEST_CODE: SECRET, BASETEN_API_KEY: SECRET, MODEL_API_KEY: SECRET, VERCEL_GIT_COMMIT_SHA: "abcdef1234567", VERCEL_ENV: "production" });
  assert.ok(s.rows.every((r) => r.level === "ok"));
  assert.equal(s.commit, "abcdef1");
  assert.equal(s.environment, "production");
  assert.match(s.planEngine, /^Muse Spark Open \(Meta open weights, on Baseten\)$/);
});

test("no value from the environment ever appears in the output", () => {
  const s = siteStatus({ SIGHTWORK_TEST_CODE: SECRET, BASETEN_API_KEY: SECRET, META_API_KEY: SECRET, META_API_BASE_URL: SECRET });
  assert.ok(!JSON.stringify(s).includes(SECRET));
});

test("no tester code: real runs off; missing keys are flagged, not hidden", () => {
  const s = siteStatus({});
  const by = Object.fromEntries(s.rows.map((r) => [r.name.split(":")[0], r.level]));
  assert.equal(by["Real runs"], "off");
  assert.equal(by["Plan engine"], "warn");
  assert.equal(by["Meta Model API"], "warn");
  assert.equal(s.commit, null);
  assert.equal(s.environment, "local");
});

test("PLAN_PROVIDER=meta checks the Meta key for the plan engine", () => {
  const s = siteStatus({ PLAN_PROVIDER: "meta", META_API_KEY: "x" });
  const engine = s.rows.find((r) => r.name.startsWith("Plan engine"))!;
  assert.equal(engine.name, "Plan engine: Muse Spark");
  assert.equal(engine.level, "ok");
});
