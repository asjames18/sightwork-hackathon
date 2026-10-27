/**
 * EXAMPLE DATA ONLY. The same made-up sanctuary stage as samplePlan, shaped the way a run
 * looks when only the plan step is available (Muse Spark Open on Baseten) and the Meta-only
 * steps are off: no SAM outlines, model-only counts, no after image. Used to build and check
 * the graceful fallback states. Open it with `?mock=nometa`.
 */
import type { FrameRef, WorkPlan } from "../types";
import { samplePlan } from "./samplePlan";

export const planNoMeta: WorkPlan = {
  ...samplePlan,
  generatedFrom: "EXAMPLE: walkthrough video, 12 frames, 78 s, narrated (plan only, no outlines or after image)",
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
