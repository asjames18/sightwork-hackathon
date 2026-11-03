/** A run cut at the host's 5-minute mark says so, and a cut mid-run never claims a small cost. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiPlanJob, RUN_LIMIT_SEC, TIME_LIMIT_FAIL } from "@/lib/client/apiPlanJob";
import { failedRunCostLine } from "@/lib/client/runCost";
import { saveTestCode } from "@/lib/client/testCode";
import { saveLocation } from "@/lib/client/location";
import type { PlanJobStatus, PlanRequest } from "@/lib/types";
import { fakeWindow } from "./browser-stubs";

/** Runs one real-run job whose plan stream stops after `planLines`; the clock moves `runSec` between request and cut. */
async function run(opts: { planLines: string; runSec: number; throws?: boolean }) {
  fakeWindow();
  saveTestCode("tester-l");
  saveLocation({ city: "Sebring", state: "FL" });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    if (opts.throws) throw new TypeError("network");
    return new Response(opts.planLines, { status: 200 });
  }) as typeof fetch;
  const req: PlanRequest = { durationSec: 40, frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,AA==" }] };
  let t = 1_000_000;
  let calls = 0;
  const clock = () => (calls++ === 0 ? t : t + opts.runSec * 1000);
  const statuses: PlanJobStatus[] = [];
  const realWarn = console.warn;
  console.warn = () => {};
  try {
    await createApiPlanJob(async () => req, "/api/plan", null, undefined, undefined, clock)({
      file: {} as File,
      onStatus: (s) => statuses.push(s),
      signal: new AbortController().signal,
    });
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
  }
  return statuses.at(-1);
}

const CUT = '{"state":"running","step":"planning"}\n';

test("a stream cut near the 5-minute mark names the time limit and flags the cost as partial", async () => {
  const last = await run({ planLines: CUT, runSec: RUN_LIMIT_SEC + 12 });
  assert.ok(last?.state === "failed");
  assert.equal(last.message, TIME_LIMIT_FAIL);
  assert.equal(last.costPartial, true);
  assert.match(TIME_LIMIT_FAIL, /5-minute limit/);
  assert.match(TIME_LIMIT_FAIL, /shorter walkthrough/);
});

test("a stream cut early is still a dropped connection, flagged partial", async () => {
  const last = await run({ planLines: CUT, runSec: 40 });
  assert.ok(last?.state === "failed");
  assert.match(last.message, /connection dropped/);
  assert.equal(last.costPartial, true);
});

test("a server failed line is never flagged partial, even late in the run", async () => {
  const last = await run({ planLines: CUT + '{"state":"failed","step":"planning","message":"stopped","costUsd":0.3}\n', runSec: 290 });
  assert.ok(last?.state === "failed");
  assert.equal(last.message, "stopped");
  assert.equal(last.costUsd, 0.3);
  assert.ok(!("costPartial" in last));
});

test("a request that never got through is not flagged partial", async () => {
  const last = await run({ planLines: CUT, runSec: 300, throws: true });
  assert.ok(last?.state === "failed");
  assert.match(last.message, /connection dropped/);
  assert.ok(!("costPartial" in last));
});

test("failedRunCostLine: partial runs never claim a small cost", () => {
  assert.equal(
    failedRunCostLine(0.004, true),
    "The AI model calls we could count cost less than 1 cent. Steps that were already running when the connection dropped may add more.",
  );
  assert.equal(
    failedRunCostLine(undefined, true),
    "Some AI model steps were already running when the connection dropped, so this run may still have cost something.",
  );
  assert.equal(failedRunCostLine(0.253, false), "The AI model calls before it stopped cost about 25 cents.");
  assert.equal(failedRunCostLine(undefined, false), null);
});
