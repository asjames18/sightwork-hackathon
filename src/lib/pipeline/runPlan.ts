/**
 * SightWork pipeline runner: one PlanRequest in, one WorkPlan out.
 *
 * Stage order, matched to the UI steps in types.ts:
 *   listening (transcribe) -> looking + counting (segment) ->
 *   comparing (reason) -> planning (cost + assembly) ->
 *   picturing (renderAfter).
 * The route emits the first "uploading" status itself, right after it
 * parses the body; this runner starts at "listening".
 *
 * The runner makes no Meta calls itself. Every model call goes through
 * a caller injected in the step deps, and every call is recorded on
 * the shared tracker, which enforces the spike cap in code.
 *
 * Failures throw PlanStepError: a pipeline step plus a plain message
 * (no provider error text, no model output), so the route can stream
 * it straight to the UI as { state: "failed", step, message }. The
 * internal detail rides on PlanStepError.detail for the server log
 * only, never for the UI. An aborted signal throws an AbortError
 * instead, so the route can just close the stream.
 *
 * Per-request prompt seam: prompts 03/05 carry per-request variables
 * (frames, transcript, region), so a static dep prompt cannot fill
 * them. The route may pass reasonPrompt / costPrompt builders on
 * RunPlanDeps instead; when present, the built prompt replaces the
 * static dep prompt for that run (including the reason retry, which
 * reuses the step prompt). When absent, the static prompt is used
 * unchanged. The seam lives here, not in the step deps, because this
 * runner already assembles both step inputs.
 */

import {
  AFTER_IMAGE_LABEL,
  checkWorkPlan,
  type PlanFrame,
  type PlanJobStatus,
  type PlanRequest,
  type PlanStep,
  type WorkPlan,
} from "../types";
import { estimateCost, type CostDeps, type CostInput } from "./cost";
import { runReason, type ReasonDeps, type ReasonInput } from "./reason";
import { runRenderAfter, type RenderAfterDeps } from "./renderAfter";
import { runSegment, type SegmentDeps } from "./segment";
import { runTranscribe, type TranscribeDeps } from "./transcribe";
import type { UsageTracker } from "./usage";

/** A pipeline failure, mapped to the UI step that stopped. */
export class PlanStepError extends Error {
  step: Exclude<PlanStep, "done">;
  /** Internal detail for the server log only; never sent to the UI. */
  detail?: string;

  constructor(step: Exclude<PlanStep, "done">, message: string, detail?: string) {
    super(message);
    this.name = "PlanStepError";
    this.step = step;
    this.detail = detail;
  }
}

/** Plain failure message per step; the UI shows these as-is. */
export const PLAIN_FAILURE_MESSAGE: Record<Exclude<PlanStep, "done">, string> = {
  uploading: "Upload failed. Try again.",
  listening: "Listening failed. Try again with a clearer recording.",
  looking: "Looking at the frames failed. Try again.",
  counting: "Counting failed. Try again.",
  comparing: "Comparing what was said with what was seen failed. Try again.",
  planning: "Building the work plan failed. Try again.",
  picturing: "Picturing the finished space failed. Try again.",
};

export interface RunPlanDeps {
  transcribe: TranscribeDeps;
  segment: SegmentDeps;
  reason: ReasonDeps;
  cost: CostDeps;
  renderAfter: RenderAfterDeps;
  /**
   * Per-request prompt builders (see header). When present, the built
   * prompt replaces the static dep prompt for that run; otherwise the
   * static prompt is used. costPrompt is only called when the request
   * has a region, since estimateCost returns null without one.
   */
  reasonPrompt?: (input: ReasonInput) => string;
  costPrompt?: (input: CostInput, spaceType?: string) => string;
  /** Shared with every step dep above; its totals land in plan.meta. */
  tracker: UsageTracker;
  /** Called with each running status, in stage order. */
  onStatus?: (status: PlanJobStatus) => void;
  /** When aborted, the run stops with an AbortError. */
  signal?: AbortSignal;
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const err = new Error("runPlan: aborted");
    err.name = "AbortError";
    throw err;
  }
}

function isAbort(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === "AbortError") ||
    (typeof err === "object" &&
      err !== null &&
      (err as { name?: unknown }).name === "AbortError")
  );
}

function detailOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Run the full pipeline for one request. The segment stage covers both
 * the "looking" and "counting" UI steps (one SAM pass does hazards and
 * counts), so both statuses are emitted around it; a segment failure
 * reports as "looking", the first of the two.
 */
export async function runPlan(request: PlanRequest, deps: RunPlanDeps): Promise<WorkPlan> {
  const emit = (step: Exclude<PlanStep, "done">): void => {
    deps.onStatus?.({ state: "running", step });
  };

  // listening: transcribe the narration, or null when there is none.
  assertNotAborted(deps.signal);
  emit("listening");
  let transcript: string | null;
  let transcriptTurns: NonNullable<WorkPlan["transcriptTurns"]>;
  try {
    const transcribed = await runTranscribe(
      { audioWavBase64: request.audioWavBase64, spaceType: request.spaceType },
      deps.transcribe,
    );
    transcript = transcribed.transcript;
    transcriptTurns = transcribed.transcriptTurns;
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new PlanStepError("listening", PLAIN_FAILURE_MESSAGE.listening, detailOf(err));
  }

  // looking + counting: SAM hazards and counts on the request frames.
  assertNotAborted(deps.signal);
  emit("looking");
  emit("counting");
  let segmentation;
  try {
    segmentation = await runSegment(
      { frames: request.frames.map((f) => ({ tSec: f.tSec, dataUrl: f.dataUrl })) },
      deps.segment,
    );
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new PlanStepError("looking", PLAIN_FAILURE_MESSAGE.looking, detailOf(err));
  }

  // comparing: Spark turns frames + segmentation + transcript into
  // issues, materials, and work steps.
  assertNotAborted(deps.signal);
  emit("comparing");
  let reason;
  try {
    const reasonInput: ReasonInput = {
      frames: request.frames.map((f) => ({ tSec: f.tSec, dataUrl: f.dataUrl })),
      segmentation,
      transcript,
      spaceName: request.spaceName,
      spaceType: request.spaceType,
      durationSec: request.durationSec,
    };
    const reasonDeps: ReasonDeps = deps.reasonPrompt
      ? { ...deps.reason, prompt: deps.reasonPrompt(reasonInput) }
      : deps.reason;
    reason = await runReason(reasonInput, reasonDeps);
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new PlanStepError("comparing", PLAIN_FAILURE_MESSAGE.comparing, detailOf(err));
  }

  // planning: region-grounded cost range (null without a region),
  // then assemble the plan shell the render step edits from.
  assertNotAborted(deps.signal);
  emit("planning");
  const frames: PlanFrame[] = request.frames.map((f, i) => ({
    index: i,
    tSec: f.tSec,
    url: f.dataUrl,
  }));
  let draft: WorkPlan;
  try {
    const costInput: CostInput = {
      spaceName: reason.spaceName,
      generatedFrom: reason.generatedFrom,
      inventory: reason.inventory,
      issues: reason.issues,
      materials: reason.materials,
      workOrder: reason.workOrder,
      region: request.region,
      laborBasis: request.laborBasis,
    };
    const costDeps: CostDeps =
      deps.costPrompt && request.region?.trim()
        ? { ...deps.cost, prompt: deps.costPrompt(costInput, request.spaceType) }
        : deps.cost;
    const cost = await estimateCost(costInput, costDeps);
    draft = {
      spaceName: reason.spaceName,
      generatedFrom: reason.generatedFrom,
      inventory: reason.inventory,
      issues: reason.issues,
      materials: cost ? cost.materials : reason.materials,
      workOrder: reason.workOrder,
      afterImageUrl: null,
      transcript,
      frames,
      transcriptTurns,
      transcriptSummary: reason.transcriptSummary,
      saidVsSeen: reason.saidVsSeen,
      costRange: cost ? cost.costRange : null,
      heroFrameIndex: reason.heroFrameIndex,
      meta: { costUsd: deps.tracker.totals().spikeTotalUsd },
    };
    const errs = checkWorkPlan(draft);
    if (errs.length > 0) {
      throw new Error(`runPlan: plan failed contract check:\n${errs.join("\n")}`);
    }
  } catch (err) {
    if (isAbort(err)) throw err;
    if (err instanceof PlanStepError) throw err;
    throw new PlanStepError("planning", PLAIN_FAILURE_MESSAGE.planning, detailOf(err));
  }

  // picturing: render the finished space, or null when skipped/failed.
  // runRenderAfter never throws for a model failure; it returns null
  // with a skip reason, so a failed render still yields a full plan.
  assertNotAborted(deps.signal);
  emit("picturing");
  const rendered = await runRenderAfter(
    { plan: draft, spaceType: request.spaceType },
    deps.renderAfter,
  );

  const plan: WorkPlan = {
    ...draft,
    afterImageUrl: rendered.afterImageUrl,
    ...(rendered.afterImageUrl ? { afterImageLabel: AFTER_IMAGE_LABEL } : {}),
    heroFrameIndex: rendered.heroFrameIndex ?? reason.heroFrameIndex,
    meta: { costUsd: deps.tracker.totals().spikeTotalUsd },
  };
  const errs = checkWorkPlan(plan);
  if (errs.length > 0) {
    throw new PlanStepError(
      "planning",
      PLAIN_FAILURE_MESSAGE.planning,
      `runPlan: final plan failed contract check:\n${errs.join("\n")}`,
    );
  }
  return plan;
}
