/**
 * Area-by-area counting, end to end and offline (proposal B).
 *
 * A synthetic one-take walkthrough (stage -> rows -> back wall -> stage again from another angle)
 * goes through the browser's zone grouping (withZoneIds), the route's body check
 * (validatePlanRequest), and then Mosheh's segment step and runPlan with fake model callers.
 * Nothing here reaches the network: every caller is a stub and fetch throws if anything tries.
 * The pipeline files are only imported and called, never changed.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { frameSignature, SIGNATURE_SIDE, type FrameSignature } from "@/lib/client/zones";
import { withZoneIds } from "@/lib/client/buildPlanRequest";
import { validatePlanRequest } from "@/lib/pipeline/planRequest";
import { planSegmentFrames, runSegment, type SegmentCaller } from "@/lib/pipeline/segment";
import { runPlan, validateRunPlanRequest, PlanStepError } from "@/lib/pipeline/runPlan";
import { buildReasonPrompt, REASON_SCHEMA } from "@/lib/pipeline/planPrompts";
import { createUsageTracker } from "@/lib/pipeline/usage";
import type { ReasonInput } from "@/lib/pipeline/reason";
import type { PlanRequest } from "@/lib/types";

const S = SIGNATURE_SIDE;

/** A synthetic area thumbnail with a small camera shift `t` (same idea as zones.test.ts). */
function area(kind: number, t = 0): FrameSignature {
  const palettes: [number, number, number][][] = [
    [[200, 40, 40], [240, 220, 200]], // stage: red carpet, cream walls
    [[30, 60, 200], [20, 20, 20]], // rows: blue chairs, dark floor
    [[40, 180, 60], [250, 250, 250]], // back wall: green exit sign, white wall
  ];
  const [a, b] = palettes[kind];
  const px = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const on = kind % 2 === 0 ? (x + t) % 16 < 8 : (y + t) % 12 < 5;
      const [r, g, bl] = on ? a : b;
      const o = (y * S + x) * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = bl;
      px[o + 3] = 255;
    }
  return frameSignature(px, S, S);
}

/** Smallest data URL every validator accepts: a JPEG header (FF D8 FF E0 ...) in valid base64. */
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

/** stage, stage, rows, rows, back, back, stage again (other angle), stage again. */
const WALK = [area(0), area(0, 1), area(1), area(1, 2), area(2), area(2, 1), area(0, 3), area(0, 5)];

/** What the fake SAM "sees" per frame, at a score above the 0.5 threshold. */
const CHAIRS = [12, 14, 30, 28, 6, 5, 13, 11]; // stage best 14, rows best 30, back best 6
const SPEAKERS = [3, 4, 0, 0, 0, 0, 4, 3]; // only on the stage; the revisit sees the same 4

function request(zoned: boolean): PlanRequest {
  const frames = WALK.map((_, i) => ({ tSec: i * 2, dataUrl: JPEG }));
  return {
    spaceName: "Zone test",
    spaceType: "room",
    durationSec: 16,
    frames: zoned ? withZoneIds(frames, WALK) : frames,
  };
}

/** Fake SAM: chairs and speakers per CHAIRS / SPEAKERS, one low-score chair everywhere (must be dropped), a water stain on frame 2. */
function fakeSam(perFrame: { chair?: number[]; loudspeaker?: number[] } = {}) {
  const calls: { concept: string; frameIndex: number }[] = [];
  const chair = perFrame.chair ?? CHAIRS;
  const loudspeaker = perFrame.loudspeaker ?? SPEAKERS;
  const caller: SegmentCaller = async ({ concept, frameIndex }) => {
    calls.push({ concept, frameIndex });
    const n = (k: number) =>
      Array.from({ length: k }, (_, i) => ({ score: 0.9, box: [10 + i, 10, 20 + i, 30] }));
    let instances: unknown[] = [];
    if (concept === "chair") instances = [...n(chair[frameIndex] ?? 0), { score: 0.3, box: [0, 0, 5, 5] }];
    if (concept === "loudspeaker") instances = n(loudspeaker[frameIndex] ?? 0);
    if (concept === "water stain" && frameIndex === 2) instances = [{ score: 0.8, box: [100, 100, 300, 200] }];
    return { instances, latencyMs: 1, costUsd: 0 };
  };
  return { caller, calls };
}

const countOf = (counts: { label: string; count: number }[], label: string) =>
  counts.find((c) => c.label === label)?.count;

let realFetch: typeof fetch;
before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("zoneCounting.test: no network allowed");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
});

describe("client -> route: zone ids on a one-take request", () => {
  test("the browser groups the walk into 3 areas and the stage revisit keeps its id", () => {
    assert.deepEqual(request(true).frames.map((f) => f.zoneId), [0, 0, 1, 1, 2, 2, 0, 0]);
  });
  test("the route's body check and runPlan's own check accept the zoned request", () => {
    assert.deepEqual(validatePlanRequest(request(true)), []);
    assert.doesNotThrow(() => validateRunPlanRequest(request(true)));
  });
  test("the route (a7f202a) and runPlan both reject a bad zone id before any step runs", () => {
    for (const zoneId of [-1, 1.5, "1" as unknown as number]) {
      const r = request(true);
      r.frames[3] = { ...r.frames[3], zoneId };
      assert.ok(validatePlanRequest(r).some((p) => p.includes("frames[3].zoneId")), `route rejects ${JSON.stringify(zoneId)}`);
      assert.throws(() => validateRunPlanRequest(r), /zoneId/);
    }
  });
});

describe("segment: area-by-area counting with a fake SAM", () => {
  test("8 frames fit the request cap, so every frame gets a count call", () => {
    const plan = planSegmentFrames({ frameCount: 8 });
    assert.deepEqual(plan.countFrames, [0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test("counts each area once: stage 14 + rows 30 + back 6 = 50 chairs, not the per-frame sum", async () => {
    const sam = fakeSam();
    const out = await runSegment({ frames: request(true).frames }, { callSegment: sam.caller, tracker: createUsageTracker() });
    assert.equal(countOf(out.counts, "Chairs"), 50);
    assert.notEqual(countOf(out.counts, "Chairs"), CHAIRS.reduce((a, b) => a + b, 0)); // 119
    // The stage seen again from another angle is the same zone: 4 speakers, not 4 + 4.
    assert.equal(countOf(out.counts, "Speakers"), 4);
    assert.deepEqual(out.flaggedFrames, [2]);
    assert.equal(out.requestsMade, sam.calls.length);
  });

  test("the low-score instance (0.3) never counts", async () => {
    const out = await runSegment(
      { frames: request(true).frames },
      { callSegment: fakeSam({ chair: [0, 0, 0, 0, 0, 0, 0, 0] }).caller, tracker: createUsageTracker() },
    );
    assert.equal(countOf(out.counts, "Chairs"), undefined, "a label whose total is 0 is omitted");
  });

  test("without zone ids the take is one zone: the old single-frame max (30)", async () => {
    const out = await runSegment({ frames: request(false).frames }, { callSegment: fakeSam().caller, tracker: createUsageTracker() });
    assert.equal(countOf(out.counts, "Chairs"), 30);
    assert.equal(countOf(out.counts, "Speakers"), 4);
  });

  test("the zoned total stays between the single-frame floor and the per-frame sum", async () => {
    const out = await runSegment({ frames: request(true).frames }, { callSegment: fakeSam().caller, tracker: createUsageTracker() });
    const chairs = countOf(out.counts, "Chairs")!;
    assert.ok(chairs >= Math.max(...CHAIRS));
    assert.ok(chairs <= CHAIRS.reduce((a, b) => a + b, 0));
  });

  test("known limit: a revisit the browser fails to match is counted as a new area", async () => {
    // Same walk, but the stage revisit came back as a new zone (3), e.g. a very different angle.
    const frames = request(true).frames.map((f, i) => (i >= 6 ? { ...f, zoneId: 3 } : f));
    const out = await runSegment({ frames }, { callSegment: fakeSam().caller, tracker: createUsageTracker() });
    assert.equal(countOf(out.counts, "Chairs"), 50 + 13, "the stage chairs are added a second time");
    assert.equal(countOf(out.counts, "Speakers"), 4 + 4);
  });
});

describe("runPlan with fake callers: zone ids reach the count the planning prompt sees", () => {
  test("segmentation in the reason prompt carries the area-by-area count", async () => {
    const tracker = createUsageTracker();
    let seen: ReasonInput | null = null;
    let prompt = "";
    let sparkCalled = false;
    const noCall = async () => {
      throw new Error("offline test: this caller must not run");
    };
    await assert.rejects(
      runPlan(request(true), {
        tracker,
        transcribe: { callTranscribe: noCall as never, tracker },
        segment: { callSegment: fakeSam().caller, tracker },
        reason: {
          prompt: "unused",
          schema: REASON_SCHEMA,
          tracker,
          callSpark: async () => {
            sparkCalled = true;
            throw new Error("offline test: stop before the plan is written");
          },
        },
        cost: { prompt: "unused", schema: {}, tracker, callSpark: noCall as never },
        renderAfter: { imageModel: "unused", callImage: noCall as never, tracker },
        reasonPrompt: (input) => {
          seen = input;
          prompt = buildReasonPrompt(input);
          return prompt;
        },
      }),
      (err: unknown) => err instanceof PlanStepError && err.step === "comparing",
    );
    assert.ok(sparkCalled, "the run got as far as the planning call");
    assert.ok(seen, "the reason prompt was built");
    const seg = (seen as ReasonInput).segmentation!;
    assert.equal(countOf(seg.counts, "Chairs"), 50);
    assert.equal(countOf(seg.counts, "Speakers"), 4);
    assert.match(prompt, /"label":"Chairs","count":50/);
    assert.equal(tracker.totals().spikeTotalUsd, 0, "no spend recorded");
  });
});
