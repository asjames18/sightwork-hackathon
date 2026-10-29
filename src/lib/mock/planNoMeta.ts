/**
 * EXAMPLE DATA ONLY. The same hand-written kitchen renovation sample as samplePlan, shaped the way a run
 * looks when only the plan step is available (Muse Spark Open on Baseten) and the Meta-only
 * steps are off: no SAM outlines, model-only counts, no after image. Used to build and check
 * the graceful fallback states. Open it with `?mock=nometa`.
 */
import type { FrameRef, WorkPlan } from "../types";
import { samplePlan } from "./samplePlan";

export const planNoMeta: WorkPlan = {
  ...samplePlan,
  generatedFrom: "SAMPLE: walkthrough, 7 frames, 45 s, narrated (plan only, no outlines or after image)",
  inventory: samplePlan.inventory.map((item) => ({ ...item, method: "model" as const })),
  issues: samplePlan.issues.map((issue) => ({
    ...issue,
    proofFrames: issue.proofFrames?.map((f: FrameRef): FrameRef => ({ frameIndex: f.frameIndex, tSec: f.tSec, caption: f.caption })),
  })),
  afterImageUrl: null,
  afterImageLabel: undefined,
  meta: {
    ...samplePlan.meta,
    isExample: true,
    planProvider: "baseten",
    skipped: { masks: true, afterImage: true },
    models: { plan: "meta-models/muse-spark-open-1026" },
  },
};

/**
 * EXAMPLE DATA ONLY. The plan-only example on a run where a region was given but the cost
 * step failed: no cost range, and meta.skipped.cost set so the screen says the cost couldn't
 * be worked out instead of asking for a region. Open it with `?mock=nocost`.
 */
export const planNoCost: WorkPlan = {
  ...planNoMeta,
  generatedFrom: "SAMPLE: walkthrough, 7 frames, 45 s, narrated (plan only, cost step failed)",
  costRange: null,
  meta: {
    ...planNoMeta.meta,
    skipped: { masks: true, afterImage: true, cost: true },
  },
};
