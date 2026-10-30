/** "Powered by Meta" credits: one row per step, real runs vs samples, skipped steps. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { creditsSummary, metaCredits, modelLabel, modelsThatRan, planEngine } from "@/lib/metaCredits";
import { EXAMPLES } from "@/lib/examples";
import type { WorkPlan } from "@/lib/types";

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Stage",
    generatedFrom: "Walkthrough video, 2 frames, 10 s, narrated",
    inventory: [{ label: "Chairs", count: 10, method: "sam" } as WorkPlan["inventory"][number]],
    issues: [],
    materials: [],
    workOrder: [],
    afterImageUrl: "/after.webp",
    transcript: "[0.0] Check the stage.",
    meta: { planProvider: "baseten" },
    ...extra,
  };
}

test("baseten plan engine is Muse Spark Open, Meta open weights", () => {
  assert.deepEqual(planEngine("baseten"), { model: "Muse Spark Open", host: "Meta open weights, on Baseten" });
  assert.equal(planEngine("meta").model, "Muse Spark");
  assert.equal(planEngine(undefined).model, "Muse Spark");
});

test("a full real run credits all four Meta models as ran, in run order", () => {
  const c = metaCredits(plan());
  assert.deepEqual(c.map((r) => r.step), ["Listen", "Look and count", "Compare and plan", "Picture"]);
  assert.ok(c.every((r) => r.status === "ran"));
  assert.deepEqual(modelsThatRan(c), ["Muse Voice Transcribe", "SAM 3.1", "Muse Spark Open", "Muse Image"]);
  assert.equal(creditsSummary(c), "4 Meta models ran: Muse Voice Transcribe, SAM 3.1, Muse Spark Open, Muse Image");
});

test("silent video, SAM skipped and no after picture are marked, never claimed", () => {
  const c = metaCredits(plan({ transcript: null, inventory: [], afterImageUrl: null, meta: { planProvider: "baseten", skipped: { masks: true, afterImage: true } } }));
  const by = Object.fromEntries(c.map((r) => [r.step, r]));
  assert.equal(by["Listen"].status, "not_needed");
  assert.equal(by["Look and count"].status, "off");
  assert.equal(by["Picture"].status, "off");
  assert.equal(by["Compare and plan"].status, "ran");
  assert.equal(creditsSummary(c), "1 Meta model ran: Muse Spark Open");
});

test("price row appears only when the cost step was asked for", () => {
  assert.ok(!metaCredits(plan()).some((r) => r.step === "Price"));
  const priced = metaCredits(plan({ costRange: { low: 100, high: 200 } as WorkPlan["costRange"] }));
  assert.equal(priced.find((r) => r.step === "Price")?.status, "ran");
  const failed = metaCredits(plan({ costRange: null, meta: { skipped: { cost: true } } }));
  assert.equal(failed.find((r) => r.step === "Price")?.status, "off");
});

test("review row: ran, didn't run, or precomputed", () => {
  const ran = metaCredits(plan({ review: { ran: true, items: [], source: "model" } }));
  assert.equal(ran.at(-1)?.step, "Review");
  assert.equal(ran.at(-1)?.status, "ran");
  assert.equal(metaCredits(plan({ review: { ran: false, items: [] } })).at(-1)?.status, "off");
  assert.equal(metaCredits(plan({ review: { ran: true, items: [], source: "precomputed" } })).at(-1)?.status, "precomputed");
});

test("hand-written samples never claim a model ran", () => {
  for (const e of EXAMPLES.filter((x) => x.kind === "sample")) {
    const c = metaCredits(e.plan, { sample: true });
    // Every model row says "in a real run"; the example's proof check says it was worked out ahead of time.
    assert.ok(c.filter((r) => r.step !== "Review").every((r) => r.status === "sample"), e.id);
    assert.equal(c.find((r) => r.step === "Review")?.status, "precomputed", e.id);
    assert.equal(modelsThatRan(c).length, 0);
    assert.match(creditsSummary(c), /^Sample plan written by hand/);
  }
});

test("the real sanctuary run credits SAM 3.1, Muse Spark Open and Muse Image", () => {
  const real = EXAMPLES.find((e) => e.id === "sanctuary")!;
  const ran = modelsThatRan(metaCredits(real.plan, { sample: false }));
  assert.deepEqual(ran, ["SAM 3.1", "Muse Spark Open", "Muse Image"]);
});

test("a sample with explicit skip flags (the ?mock=nometa preview) still shows those steps as off", () => {
  const c = metaCredits(plan({ meta: { isExample: true, skipped: { masks: true, afterImage: true } } }));
  const by = Object.fromEntries(c.map((r) => [r.step, r.status]));
  assert.equal(by["Look and count"], "off");
  assert.equal(by["Picture"], "off");
  assert.equal(by["Compare and plan"], "sample");
});

test("recorded model ids (plan.meta.models) show on rows that ran and fix the name and host", () => {
  const c = metaCredits(
    plan({
      costRange: { low: 100, high: 200 } as WorkPlan["costRange"],
      review: { ran: true, items: [], source: "model" },
      meta: {
        planProvider: "baseten",
        models: {
          transcribe: "muse-voice-transcribe-1.0",
          segment: "sam-3.1",
          reason: "meta-models/muse-spark-open-1026",
          cost: "muse-spark-1.3",
          image: "muse-image-1.0",
          review: "meta-models/muse-spark-open-1026",
        },
      },
    }),
  );
  const by = Object.fromEntries(c.map((r) => [r.step, r]));
  assert.equal(by["Listen"].modelId, "muse-voice-transcribe-1.0");
  assert.equal(by["Look and count"].modelId, "sam-3.1");
  assert.equal(by["Compare and plan"].model, "Muse Spark Open");
  assert.equal(by["Compare and plan"].modelId, "meta-models/muse-spark-open-1026");
  assert.equal(by["Price"].model, "Muse Spark");
  assert.equal(by["Price"].host, "Meta Model API, web search");
  assert.equal(by["Picture"].modelId, "muse-image-1.0");
  assert.equal(by["Review"].model, "Muse Spark Open");
  assert.equal(by["Review"].host, "Meta open weights, on Baseten");
});

test("recorded ids never mark a step as ran, and a row that didn't run shows no id", () => {
  const c = metaCredits(plan({ afterImageUrl: null, meta: { planProvider: "baseten", skipped: { afterImage: true }, models: { image: "muse-image-1.0" } } }));
  const pic = c.find((r) => r.step === "Picture");
  assert.equal(pic?.status, "off");
  assert.equal(pic?.modelId, undefined);
});

test("a price step that ran on Muse Spark Open is credited to it, keeping the web search note", () => {
  const c = metaCredits(plan({ costRange: { low: 1, high: 2 } as WorkPlan["costRange"], meta: { planProvider: "baseten", models: { cost: "meta-models/muse-spark-open-1026" } } }));
  const price = c.find((r) => r.step === "Price");
  assert.equal(price?.model, "Muse Spark Open");
  assert.equal(price?.host, "Meta open weights, on Baseten, web search");
});

test("unknown model id keeps the default label but still shows the id; samples never show ids", () => {
  const c = metaCredits(plan({ meta: { planProvider: "baseten", models: { reason: "some-new-model-2" } } }));
  const r = c.find((x) => x.step === "Compare and plan");
  assert.equal(r?.model, "Muse Spark Open");
  assert.equal(r?.modelId, "some-new-model-2");
  const s = metaCredits(plan({ meta: { isExample: true, models: { reason: "meta-models/muse-spark-open-1026" } } }));
  assert.ok(s.every((x) => x.modelId === undefined));
});

test("modelLabel maps known ids and ignores blanks", () => {
  assert.equal(modelLabel("SAM-3.1")?.model, "SAM 3.1");
  assert.equal(modelLabel("muse-spark")?.model, "Muse Spark");
  assert.equal(modelLabel("muse-voice-transcribe-1.0")?.model, "Muse Voice Transcribe");
  assert.equal(modelLabel("   "), null);
  assert.equal(modelLabel("samsung-x"), null);
});
