/** The plan keeps the City, ST it was run for (meta.region), even when the cost step failed. No network. */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { planLocation, withRunRegion } from "@/lib/client/planText";
import { createApiPlanJob } from "@/lib/client/apiPlanJob";
import { saveLocation } from "@/lib/client/location";
import { saveTestCode } from "@/lib/client/testCode";
import type { PlanJobStatus, PlanRequest, WorkPlan } from "@/lib/types";
import { fakeWindow, noWindow } from "./browser-stubs";

afterEach(noWindow);

const base = { spaceName: "Stage", issues: [], steps: [], materials: [], inventory: [] } as unknown as WorkPlan;

describe("planLocation", () => {
  test("prefers meta.region, kept when the cost step failed", () => {
    assert.equal(planLocation({ costRange: null, meta: { region: "  Sebring,   FL " } }), "Sebring, FL");
  });
  test("falls back to the cost range region", () => {
    assert.equal(planLocation({ costRange: { region: "Tampa, FL" } as WorkPlan["costRange"] }), "Tampa, FL");
  });
  test("is null with neither, or with blank values", () => {
    assert.equal(planLocation({}), null);
    assert.equal(planLocation({ meta: { region: "  " }, costRange: null }), null);
  });
});

describe("withRunRegion", () => {
  test("stamps the sent region when the server left it off, without mutating", () => {
    const plan = { ...base, meta: { costUsd: 0.7 } } as WorkPlan;
    const out = withRunRegion(plan, "Sebring, FL");
    assert.deepEqual(out.meta, { costUsd: 0.7, region: "Sebring, FL" });
    assert.deepEqual(plan.meta, { costUsd: 0.7 });
  });
  test("adds meta when the plan has none", () => {
    assert.deepEqual(withRunRegion(base, "Austin, TX").meta, { region: "Austin, TX" });
  });
  test("keeps a region the server already set", () => {
    const plan = { ...base, meta: { region: "Orlando, FL" } } as WorkPlan;
    assert.equal(withRunRegion(plan, "Sebring, FL"), plan);
  });
  test("changes nothing for a missing or blank region", () => {
    assert.equal(withRunRegion(base, undefined), base);
    assert.equal(withRunRegion(base, "   "), base);
  });
});

async function runDone(plan: WorkPlan): Promise<PlanJobStatus[]> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ state: "done", plan }) + "\n", {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    })) as typeof fetch;
  const statuses: PlanJobStatus[] = [];
  try {
    const req: PlanRequest = { durationSec: 30, frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,AA==" }] };
    await createApiPlanJob(async () => req)({ file: {} as File, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
  } finally {
    globalThis.fetch = realFetch;
  }
  return statuses;
}

describe("real run result", () => {
  test("a finished plan with no cost range still carries the City, ST that was sent", async () => {
    fakeWindow();
    saveTestCode("tester");
    saveLocation({ city: "Sebring", state: "FL" });
    const statuses = await runDone({ ...base, costRange: null, meta: { skipped: { cost: true } } } as WorkPlan);
    const done = statuses.find((s) => s.state === "done");
    assert.ok(done && done.state === "done");
    assert.equal(done.plan.meta?.region, "Sebring, FL");
    assert.deepEqual(done.plan.meta?.skipped, { cost: true });
    assert.equal(planLocation(done.plan), "Sebring, FL");
  });
  test("a region the server set is left alone", async () => {
    fakeWindow();
    saveTestCode("tester");
    saveLocation({ city: "Sebring", state: "FL" });
    const statuses = await runDone({ ...base, meta: { region: "Avon Park, FL" } } as WorkPlan);
    const done = statuses.find((s) => s.state === "done");
    assert.ok(done && done.state === "done");
    assert.equal(done.plan.meta?.region, "Avon Park, FL");
  });
});
