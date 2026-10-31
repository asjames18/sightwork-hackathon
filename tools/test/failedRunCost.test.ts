/** A run that stops says what it already billed: failed-line costUsd plus the split transcribe request. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiPlanJob, parseStatusLine, withFailureCost } from "@/lib/client/apiPlanJob";
import { failedRunCostLine } from "@/lib/client/runCost";
import { saveTestCode } from "@/lib/client/testCode";
import { saveLocation } from "@/lib/client/location";
import type { PlanJobStatus, PlanRequest } from "@/lib/types";
import { fakeWindow } from "./browser-stubs";

async function run(opts: { planLine: string; transcribe?: unknown; transcribeStatus?: number; audio?: boolean }) {
  fakeWindow();
  saveTestCode("tester-f");
  saveLocation({ city: "Sebring", state: "FL" });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url === "/api/transcribe") return new Response(JSON.stringify(opts.transcribe ?? {}), { status: opts.transcribeStatus ?? 200 });
    return new Response(opts.planLine, { status: 200 });
  }) as typeof fetch;
  const req: PlanRequest = {
    durationSec: 40,
    frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,AA==" }],
    ...(opts.audio ? { audioWavBase64: "UklGRg==" } : {}),
  };
  const statuses: PlanJobStatus[] = [];
  const realWarn = console.warn;
  console.warn = () => {};
  try {
    await createApiPlanJob(async () => req)({ file: {} as File, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
  }
  return statuses.at(-1);
}

test("parseStatusLine keeps a real costUsd on a failed line and drops junk", () => {
  const ok = parseStatusLine('{"state":"failed","step":"comparing","message":"m","costUsd":0.0021}');
  assert.deepEqual(ok, { state: "failed", step: "comparing", message: "m", costUsd: 0.0021 });
  for (const bad of ['"0.5"', "-1", "0", "null"]) {
    const s = parseStatusLine(`{"state":"failed","step":"comparing","message":"m","costUsd":${bad}}`);
    assert.ok(s?.state === "failed" && !("costUsd" in s), `dropped ${bad}`);
  }
});

test("withFailureCost adds the transcribe cost, and leaves nothing when nothing billed", () => {
  const base = { state: "failed" as const, step: "comparing" as const, message: "m" };
  assert.equal(withFailureCost({ ...base, costUsd: 0.1 }, 0.02).costUsd, 0.12);
  assert.equal(withFailureCost(base, 0.02).costUsd, 0.02);
  assert.ok(!("costUsd" in withFailureCost(base, 0)));
});

test("a streamed failed line shows server cost plus the split transcribe cost", async () => {
  const last = await run({
    audio: true,
    transcribe: { transcript: "the rail is loose", transcriptTurns: [], costUsd: 0.003 },
    planLine: '{"state":"running","step":"comparing"}\n{"state":"failed","step":"comparing","message":"stopped","costUsd":0.25}\n',
  });
  assert.ok(last?.state === "failed");
  assert.equal(last.costUsd, 0.253);
  assert.equal(last.message, "stopped");
});

test("a failed line with no cost and no narration stays without one", async () => {
  const last = await run({ planLine: '{"state":"failed","step":"uploading","message":"x"}\n' });
  assert.ok(last?.state === "failed" && !("costUsd" in last));
});

test("a dropped connection after a billed transcribe still reports that cost", async () => {
  const last = await run({
    audio: true,
    transcribe: { transcript: "hi", transcriptTurns: [], costUsd: 0.004 },
    planLine: '{"state":"running","step":"planning"}\n',
  });
  assert.ok(last?.state === "failed" && /connection dropped/.test(last.message));
  assert.equal(last.costUsd, 0.004);
});

test("failedRunCostLine: plain sentence, nothing for unknown or zero", () => {
  assert.equal(failedRunCostLine(0.253), "The AI model calls before it stopped cost about 25 cents.");
  assert.equal(failedRunCostLine(0.004), "The AI model calls before it stopped cost less than 1 cent.");
  assert.equal(failedRunCostLine(1.4), "The AI model calls before it stopped cost about $1.40.");
  assert.equal(failedRunCostLine(undefined), null);
  assert.equal(failedRunCostLine(0), null);
});
