/**
 * The note for a real plan that finished without its after picture. The server leaves the picture out when
 * the run is running long or the picture step can't run; the plan itself is still complete. Pure helper.
 */
import type { WorkPlan } from "@/lib/types";

export const NO_AFTER_PICTURE_TEXT =
  "This plan came back without an after picture. The problems, counts, steps and cost are all here. A shorter walkthrough leaves a run more time for the picture.";

/** The note text when the plan has no after picture because that step was skipped; null otherwise. */
export function afterPictureNote(plan: Pick<WorkPlan, "afterImageUrl" | "meta">): string | null {
  if (plan.afterImageUrl) return null;
  if (plan.meta?.skipped?.afterImage !== true) return null;
  return NO_AFTER_PICTURE_TEXT;
}
