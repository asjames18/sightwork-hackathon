/**
 * runPlan step-check lines (097eada), end to end and offline: every model caller is a stub and
 * fetch throws. The check lines runPlan streams must say exactly what stepChecksForPlan says about
 * the finished plan, so the processing screen and the plan never disagree. A check line is never
 * a failure, and it is always an extra running line for a step the run already reached.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { runPlan, type RunPlanDeps } from "@/lib/pipeline/runPlan";
import { REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { createUsageTracker } from "@/lib/pipeline/usage";
import type { SegmentCaller } from "@/lib/pipeline/segment";
import { stepChecksForPlan } from "@/lib/stepChecks";
import type { PlanJobStatus, PlanRequest, RunStep, StepCheck, WorkPlan } from "@/lib/types";
import sanctuary from "@/lib/examples/sanctuary-run.json";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";
const S = sanctuary as unknown as WorkPlan;

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("runPlanStepChecks.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

const TURNS = [
  { startSec: 2, text: "This is the main stage." },
  { startSec: 9, text: "The carpet on the steps is worn." },
];

function request(narrated: boolean): PlanRequest {
  return {
    spaceName: S.spaceName,
    spaceType: "sanctuary",
    durationSec: 48,
    frames: (S.frames ?? []).map((f) => ({ tSec: f.tSec, dataUrl: JPEG })),
    transcript: narrated ? TURNS.map((t) => `[${t.startSec}] ${t.text}`).join("\n") : null,
    transcriptTurns: narrated ? TURNS : [],
  };
}

/** The stored real plan's reason fields, as the model would return them. */
function reasonJson(edit: (o: Record<string, unknown>) => void = () => {}): unknown {
  const o: Record<string, unknown> = JSON.parse(
    JSON.stringify({
      spaceName: S.spaceName,
      generatedFrom: S.generatedFrom,
      inventory: S.inventory,
      issues: S.issues,
      materials: S.materials,
      workOrder: S.workOrder,
      transcriptSummary: null,
      saidVsSeen: [],
      heroFrameIndex: S.heroFrameIndex,
    }),
  );
  edit(o);
  return o;
}

const sam: SegmentCaller = async () => ({ instances: [], latencyMs: 1, costUsd: 0 });
const samDown: SegmentCaller = async () => {
  throw new Error("offline test: SAM unavailable");
};

async function run(opts: {
  narrated?: boolean;
  segment?: SegmentCaller;
  json?: unknown;
  image?: boolean;
}): Promise<{ plan: WorkPlan; statuses: PlanJobStatus[] }> {
  const tracker = createUsageTracker();
  const statuses: PlanJobStatus[] = [];
  const noCall = async () => {
    throw new Error("offline test: this caller must not run");
  };
  const deps: RunPlanDeps = {
    tracker,
    transcribe: { callTranscribe: noCall as never, tracker },
    segment: { callSegment: opts.segment ?? sam, tracker },
    reason: {
      prompt: "offline",
      schema: REASON_SCHEMA,
      tracker,
      callSpark: async () => ({ json: opts.json ?? reasonJson(), latencyMs: 1, costUsd: 0 }),
    },
    cost: { prompt: "unused", schema: {}, tracker, callSpark: noCall as never },
    renderAfter: {
      imageModel: "offline",
      tracker,
      callImage: (opts.image === false
        ? async () => {
            throw new Error("offline test: image model down");
          }
        : async () => ({ images: [JPEG], latencyMs: 1, costUsd: 0 })) as never,
    },
    onStatus: (s) => statuses.push(s),
  };
  const plan = await runPlan(request(opts.narrated ?? false), deps);
  return { plan, statuses };
}

/** The check carried for each step, in stream order. */
function checks(statuses: PlanJobStatus[]): [RunStep, StepCheck][] {
  const out: [RunStep, StepCheck][] = [];
  for (const s of statuses) {
    const c = (s as { check?: StepCheck }).check;
    if (s.state === "running" && c) out.push([s.step as RunStep, c]);
  }
  return out;
}

describe("runPlan step-check lines (offline)", () => {
  test("each streamed check equals stepChecksForPlan on the finished plan", async () => {
    const { plan, statuses } = await run({ narrated: true });
    const want = stepChecksForPlan(plan);
    const got = checks(statuses);
    assert.ok(got.length > 0, "at least one check line");
    for (const [step, c] of got) assert.deepEqual(c, want[step], `check for ${step}`);
  });

  test("a check line only ever follows a plain running line for the same step", async () => {
    const { statuses } = await run({ narrated: true });
    const seen = new Set<string>();
    for (const s of statuses) {
      if (s.state !== "running") continue;
      const c = (s as { check?: StepCheck }).check;
      if (c) assert.ok(seen.has(s.step), `${s.step} check came before its step started`);
      else seen.add(s.step);
    }
  });

  test("narrated run: listening counts the turn words and comparing splits mentioned/unmentioned", async () => {
    const { plan, statuses } = await run({ narrated: true });
    const got = new Map(checks(statuses));
    assert.deepEqual(got.get("listening"), { ok: true, note: "Transcript: 12 words" });
    const said = plan.issues.filter((i) => !i.unmentioned).length;
    assert.deepEqual(got.get("comparing"), { ok: true, note: `${said} you mentioned, ${plan.issues.length - said} you didn't` });
  });

  test("silent run: listening says no narration and there is no comparing line", async () => {
    const { statuses } = await run({ narrated: false });
    const got = new Map(checks(statuses));
    assert.deepEqual(got.get("listening"), { ok: true, note: "No narration in this video" });
    assert.equal(got.has("comparing"), false);
  });

  test("planning: every problem has a proof frame on the real plan", async () => {
    const { plan, statuses } = await run({});
    const got = new Map(checks(statuses));
    assert.deepEqual(got.get("planning"), { ok: true, note: `Plan: ${plan.issues.length} problems, each with a proof frame` });
  });

  test("picturing: a made after picture gets a line, a failed render gets none and the run still finishes", async () => {
    const made = new Map(checks((await run({})).statuses));
    assert.deepEqual(made.get("picturing"), { ok: true, note: "After picture made" });
    const { plan, statuses } = await run({ image: false });
    assert.equal(plan.afterImageUrl, null);
    assert.equal(new Map(checks(statuses)).has("picturing"), false);
  });

  test("counting: one count with no outline is an ok:false finding, never a failed run", async () => {
    const json = reasonJson((o) => {
      const inv = o.inventory as { method: string }[];
      inv[0] = { ...inv[0], method: "model" };
    });
    const { plan, statuses } = await run({ json });
    const got = new Map(checks(statuses));
    assert.deepEqual(got.get("counting"), { ok: false, note: "1 count had no outline, marked estimated" });
    assert.ok(plan.issues.length > 0, "the plan still finished");
    assert.equal(statuses.some((s) => s.state === "failed"), false);
  });

  test("counting: no line when SAM is down, matching the finished plan", async () => {
    const { plan, statuses } = await run({ segment: samDown });
    assert.equal(new Map(checks(statuses)).has("counting"), false);
    assert.equal(stepChecksForPlan(plan).counting, undefined);
  });

  test("no check line ever names reviewing or done", async () => {
    const { statuses } = await run({ narrated: true });
    for (const [step] of checks(statuses)) assert.ok(step !== ("done" as RunStep) && step !== "reviewing");
  });
});
