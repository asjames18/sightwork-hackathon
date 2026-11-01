import { masksAvailable, type Box, type PlanFrame, type WorkPlan } from "@/lib/types";
import { boxSource } from "@/lib/planExtras";

/** What "Send this step" can attach: the proof photo of the first problem the step fixes, outlined as on screen. */
export interface StepPhotoSource {
  frame: PlanFrame;
  box: Box | undefined;
  dashed: boolean;
  /** The problem the photo shows. */
  rank: number;
  title: string;
}

/**
 * The first problem in the step's "Fixes" list that was seen on camera and has a frame, so the person doing the
 * step sees what to look for. Null when the step fixes nothing, or nothing it fixes has a frame (e.g. a problem
 * only mentioned on the walk, never seen).
 */
export function stepPhotoSource(plan: WorkPlan, step: WorkPlan["workOrder"][number]): StepPhotoSource | null {
  const frames = plan.frames ?? [];
  const masks = masksAvailable(plan);
  for (const rank of step.fixes ?? []) {
    const issue = plan.issues.find((i) => i.rank === rank);
    if (!issue || issue.status === "mentioned_not_seen") continue;
    const proof = issue.proofFrames?.[0];
    const frame = frames[proof?.frameIndex ?? issue.frameIndex];
    if (!frame?.url) continue;
    return { frame, box: proof?.box, dashed: !masks && boxSource(proof) !== "sam", rank: issue.rank, title: issue.title };
  }
  return null;
}
