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
  type PlanProvider,
  type PlanRequest,
  type PlanStep,
  type WorkPlan,
} from "../types";
import { estimateCost, type CostDeps, type CostInput } from "./cost";
import { MAX_PLAN_FRAMES } from "./planRequest";
import {
  runReason,
  type ReasonDeps,
  type ReasonInput,
  type ReasonOutput,
} from "./reason";
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
  /**
   * Which engine wrote the reason step (meta or baseten). Lands in
   * plan.meta alongside the cost total, so the plan itself names its
   * engine; omitted leaves meta.planProvider unset.
   */
  planProvider?: PlanProvider;
  /**
   * Cap on frames handed to the reason step (Grok Bot, 2026-10-27
   * 11:43 AM: the Baseten reason call takes at most 8 images). The
   * route sets it in baseten mode only; the meta path is untouched.
   * When set, runPlan picks a subset (pickReasonFrames), the reason
   * step sees subset positions, and its output is remapped back to
   * plan frames (remapReasonOutput) before assembly. Unset means no
   * subsetting: the reason step sees every request frame.
   */
  reasonMaxFrames?: number;
  /**
   * SAM pool size for the segment step (segment.ts: at most this
   * many SAM calls in flight; default DEFAULT_SEGMENT_CONCURRENCY
   * when unset). The route may lower it under a tight spike budget
   * or raise it when latency matters; unset keeps runSegment's
   * own default, so existing callers are untouched.
   */
  segmentConcurrency?: number;
  /** Called with each running status, in stage order. When optional
   * steps were skipped earlier in the run, the status carries the
   * cumulative skipped list (Grok Bot, 2026-10-27 5:45 PM: the
   * processing screen shows those steps as skipped this run); the
   * field is omitted when nothing was skipped. */
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

/**
 * True when a contract error was already reported as a reason warning.
 * Compared by field key (issues[0], heroFrameIndex, ...), not exact
 * text, because validateReason phrases frame errors with values while
 * checkWorkPlan phrases them without. A costRange error can never be
 * explained by a reason warning, so a new cost error still throws.
 */
function explainedByReasonWarnings(err: string, warnings: string[]): boolean {
  const key = (text: string): string => {
    const m = /^(issues\[\d+\]|workOrder\[\d+\]|inventory\[\d+\]|saidVsSeen\[\d+\])/.exec(text);
    if (m) return m[1];
    if (text.startsWith("heroFrameIndex")) return "heroFrameIndex";
    return text;
  };
  return warnings.some((w) => key(w) === key(err));
}

function detailOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * True when the error is a usage-tracker spike-cap throw. A cap breach
 * is a spending stop, not an optional-step failure: the run must fail
 * fast instead of continuing to later steps, each of which would spend
 * another call before its own tracker record throws.
 */
function isSpikeCapError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /spike cap/i.test(message);
}

/** Baseten reason-call image cap (Grok Bot, 2026-10-27 11:43 AM). */
export const REASON_MAX_FRAMES = 8;

/**
 * Pick the subset of request frames handed to the reason step when it
 * is capped (Baseten mode). Evenly spaced across the walkthrough,
 * always including the first and last frame; any frame that holds a
 * hazard or mask hit (segmentation.flaggedFrames) is swapped in
 * before a plain frame, displacing the plain, non-endpoint subset
 * member nearest to it. First and last frames are never displaced.
 * A flagged frame is left out only when every subset member is
 * already an endpoint or a flagged frame. Returns original frame
 * indices, ascending. With no cap pressure (frameCount <= maxFrames)
 * the subset is every frame, so the remap below is the identity.
 */
export function pickReasonFrames(
  frameCount: number,
  flaggedFrames: number[],
  maxFrames: number,
): number[] {
  if (frameCount <= 0 || maxFrames <= 0) return [];
  // A cap of 1 would divide by zero in the spacing below
  // (i * (frameCount - 1) / (maxFrames - 1)), yielding a NaN subset
  // index and an undefined frame downstream. The route only ever
  // passes 8, but the function is exported, so fail safe: with one
  // slot, the subset is the first frame, which the spacing would
  // have picked first anyway.
  if (maxFrames === 1) return [0];
  if (frameCount <= maxFrames) {
    return Array.from({ length: frameCount }, (_, i) => i);
  }
  const subset: number[] = [];
  const inSubset = new Set<number>();
  for (let i = 0; i < maxFrames; i++) {
    const idx = Math.round((i * (frameCount - 1)) / (maxFrames - 1));
    if (!inSubset.has(idx)) {
      inSubset.add(idx);
      subset.push(idx);
    }
  }
  // Rounding cannot collide when frameCount > maxFrames (step > 1),
  // but fill defensively so the subset is never short.
  for (let i = 0; subset.length < maxFrames && i < frameCount; i++) {
    if (!inSubset.has(i)) {
      inSubset.add(i);
      subset.push(i);
    }
  }
  const flagged = [...new Set(flaggedFrames)]
    .filter((f) => Number.isInteger(f) && f >= 0 && f < frameCount)
    .sort((a, b) => a - b);
  const flaggedSet = new Set(flagged);
  for (const f of flagged) {
    if (inSubset.has(f)) continue;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const m of subset) {
      if (m === 0 || m === frameCount - 1) continue;
      if (flaggedSet.has(m)) continue;
      const dist = Math.abs(m - f);
      if (dist < bestDist) {
        bestDist = dist;
        best = m;
      }
    }
    if (best === null) continue;
    inSubset.delete(best);
    inSubset.add(f);
    subset[subset.indexOf(best)] = f;
  }
  subset.sort((a, b) => a - b);
  return subset;
}

/**
 * Remap a reason result from subset positions back to plan-frame
 * indices (Grok Bot, 2026-10-27 11:43 AM). `subset` maps a subset
 * position to its original frame index; frameTimeSec values need no
 * change, because a subset frame is the same frame (same tSec) as
 * its original. Any index outside the subset is dropped rather
 * than guessed: an issue whose primary frame is outside the subset
 * is dropped (with rank renumbering and rank-reference remapping,
 * as in filterAndRenumber), a stray proof frame is dropped, and a
 * said-vs-seen seen frame outside the subset is dropped to null.
 * An unmentioned issue left with no proof frames is dropped too,
 * or the plan contract would fail it for having none. The hero
 * frame is the one index that cannot be dropped: when it falls
 * outside the subset, it falls back to the first subset frame and
 * the fallback is logged server-side, so the render step still has
 * a real frame (flagged for Grok Bot to confirm or replace with a
 * run failure).
 */
export function remapReasonOutput(output: ReasonOutput, subset: number[]): ReasonOutput {
  if (subset.length === 0) return output;
  const toOriginal = (subsetPos: number): number | null =>
    Number.isInteger(subsetPos) && subsetPos >= 0 && subsetPos < subset.length
      ? subset[subsetPos]
      : null;
  const keptIssues: (typeof output.issues)[number][] = [];
  for (const issue of output.issues) {
    const frameIndex = toOriginal(issue.frameIndex);
    if (frameIndex === null) continue;
    const proofFrames = issue.proofFrames
      ?.map((pf) => {
        const mapped = toOriginal(pf.frameIndex);
        return mapped === null ? null : { ...pf, frameIndex: mapped };
      })
      .filter((pf): pf is NonNullable<typeof pf> => pf !== null);
    if (issue.unmentioned && proofFrames !== undefined && proofFrames.length === 0) {
      continue;
    }
    keptIssues.push({ ...issue, frameIndex, proofFrames });
  }
  const rankRemap = new Map<number, number>();
  keptIssues.forEach((issue, i) => rankRemap.set(issue.rank, i + 1));
  const remapRanks = (ranks: number[] | undefined): number[] | undefined =>
    ranks === undefined
      ? undefined
      : ranks.filter((r) => rankRemap.has(r)).map((r) => rankRemap.get(r) as number);
  const hero = toOriginal(output.heroFrameIndex);
  if (hero === null) {
    console.warn(
      `runPlan: reason heroFrameIndex ${output.heroFrameIndex} outside the reason subset, falling back to subset frame ${subset[0]}`,
    );
  }
  return {
    ...output,
    issues: keptIssues.map((issue) => ({ ...issue, rank: rankRemap.get(issue.rank) as number })),
    materials: output.materials.map((m) => ({ ...m, forIssues: remapRanks(m.forIssues) })),
    workOrder: output.workOrder.map((s) => ({ ...s, fixes: remapRanks(s.fixes) })),
    saidVsSeen: output.saidVsSeen
      .filter((row) => row.issueRank === undefined || rankRemap.has(row.issueRank))
      .map((row) => {
        if (!row.seen) return { ...row, issueRank: row.issueRank === undefined ? undefined : rankRemap.get(row.issueRank) };
        const seenIndex = toOriginal(row.seen.frameIndex);
        return {
          ...row,
          issueRank: row.issueRank === undefined ? undefined : rankRemap.get(row.issueRank),
          seen: seenIndex === null ? null : { ...row.seen, frameIndex: seenIndex },
        };
      }),
    heroFrameIndex: hero ?? subset[0],
  };
}

/**
 * Fail fast on bad wiring before any step call. The route already
 * validates the request body (planRequest.ts), so this covers the
 * dep side only — the part no step validates up front. Two real
 * gaps closed: a tracker without totals() used to throw only at
 * plan assembly, after the paid reason and cost calls, when
 * planMeta read the totals; and a missing later step bundle (e.g.
 * segment) used to surface only at its own stage, after the
 * earlier paid calls. A bad reasonMaxFrames is caught here too:
 * pickReasonFrames returns [] for a cap <= 0, which would hand
 * the reason step no frames at all.
 */
export function validateRunPlanDeps(deps: RunPlanDeps): void {
  if (deps === null || typeof deps !== "object" || Array.isArray(deps)) {
    throw new Error("runPlan: deps is not an object");
  }
  for (const field of ["transcribe", "segment", "reason", "cost", "renderAfter"] as const) {
    const v = deps[field];
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      throw new Error(`runPlan: ${field} deps is not an object`);
    }
  }
  if (
    deps.tracker === null ||
    typeof deps.tracker !== "object" ||
    typeof deps.tracker.record !== "function" ||
    typeof deps.tracker.totals !== "function"
  ) {
    throw new Error("runPlan: tracker.record and tracker.totals must be functions");
  }
  if (
    deps.planProvider !== undefined &&
    deps.planProvider !== "meta" &&
    deps.planProvider !== "baseten"
  ) {
    throw new Error(`runPlan: planProvider must be meta or baseten, got ${deps.planProvider}`);
  }
  if (
    deps.reasonMaxFrames !== undefined &&
    (!Number.isInteger(deps.reasonMaxFrames) || deps.reasonMaxFrames < 1)
  ) {
    throw new Error("runPlan: reasonMaxFrames must be a whole number >= 1 when given");
  }
  if (
    deps.segmentConcurrency !== undefined &&
    (!Number.isInteger(deps.segmentConcurrency) || deps.segmentConcurrency < 1)
  ) {
    throw new Error("runPlan: segmentConcurrency must be a whole number >= 1 when given");
  }
  for (const field of ["reasonPrompt", "costPrompt", "onStatus"] as const) {
    if (deps[field] !== undefined && typeof deps[field] !== "function") {
      throw new Error(`runPlan: ${field} must be a function when given`);
    }
  }
  if (deps.signal !== undefined && (deps.signal === null || typeof deps.signal !== "object")) {
    throw new Error("runPlan: signal must be an object when given");
  }
}


/**
 * Shape check for a direct runPlan caller. The route already deep-validates
 * the body with validatePlanRequest (src/lib/pipeline/planRequest.ts), but
 * runPlan is also callable on its own, and until now it trusted the request
 * outright: a non-object request threw a bare TypeError, and an
 * empty-frames request paid for transcription before the segment step
 * failed. This fails fast, before the first step, with the same
 * "runPlan: ..." phrasing as validateRunPlanDeps. Shape only: it mirrors
 * the route validator's frame and image checks so a direct caller fails
 * fast the same way; WAV format stays with the route validator and the
 * step validators.
 */
/**
 * True when the string is valid base64, by the same rule the route
 * validator uses (src/lib/pipeline/planRequest.ts): base64 alphabet
 * plus up to two padding chars, length a multiple of 4, whitespace
 * ignored. Used only by validateRunPlanRequest below.
 */
function isBase64(value: string): boolean {
  const stripped = value.replace(/\s/g, "");
  return /^[A-Za-z0-9+/]*={0,2}$/.test(stripped) && stripped.length % 4 === 0;
}

/**
 * True when the base64 string decodes to a real image header, by the
 * same magic-byte rule the route validator uses: JPEG (FF D8 FF),
 * PNG (89 50 4E 47 0D 0A 1A 0A), GIF ("GIF87a"/"GIF89a"), or WebP
 * ("RIFF" + "WEBP" at bytes 8-11). Only the first 12 bytes are
 * decoded, with atob (not Buffer) so this pure module stays free of
 * node types. A payload too short to hold any header fails.
 */
function isImageBase64(value: string): boolean {
  const stripped = value.replace(/\s/g, "");
  const chunk = stripped.slice(0, 16);
  if (chunk.length < 8) return false;
  const head = atob(chunk.length % 4 === 0 ? chunk : chunk.slice(0, chunk.length - (chunk.length % 4)));
  const b = (i: number): number => head.charCodeAt(i);
  if (head.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return true;
  if (
    head.length >= 8 &&
    b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 &&
    b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a
  ) return true;
  if (head.length >= 6 && head.slice(0, 6) === "GIF87a") return true;
  if (head.length >= 6 && head.slice(0, 6) === "GIF89a") return true;
  if (head.length >= 12 && head.slice(0, 4) === "RIFF" && head.slice(8, 12) === "WEBP") return true;
  return false;
}

export function validateRunPlanRequest(request: PlanRequest): void {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("runPlan: request is not an object");
  }
  if (
    typeof request.durationSec !== "number" ||
    !Number.isFinite(request.durationSec) ||
    request.durationSec < 0
  ) {
    throw new Error("runPlan: durationSec must be a number >= 0");
  }
  if (!Array.isArray(request.frames) || request.frames.length === 0) {
    throw new Error("runPlan: frames must be a non-empty array");
  }
  // Parity with the route validator (src/lib/pipeline/planRequest.ts):
  // the browser builder sends at most 48 frames, and the route
  // rejects more before any model call is spent. A direct runPlan
  // caller with 49+ frames inside durationSec used to pass here and
  // only hit the reason step's image limit mid-run; it gets the same
  // fail-fast here instead of only via the route.
  if (request.frames.length > MAX_PLAN_FRAMES) {
    throw new Error(`runPlan: frames must not exceed ${MAX_PLAN_FRAMES}`);
  }
  // Parity with the route validator (src/lib/pipeline/planRequest.ts):
  // frames must arrive in walkthrough order (non-decreasing tSec) —
  // the reason subset picks evenly spaced frames by position, so an
  // out-of-order request would silently mis-order the comparison, while
  // the route already fails fast on the same input.
  let prevTsec = 0;
  request.frames.forEach((frame, i) => {
    if (
      frame === null ||
      typeof frame !== "object" ||
      typeof frame.tSec !== "number" ||
      !Number.isFinite(frame.tSec) ||
      frame.tSec < 0 ||
      typeof frame.dataUrl !== "string" ||
      frame.dataUrl.trim().length === 0
    ) {
      throw new Error(`runPlan: frames[${i}] has no valid tSec/dataUrl`);
    }
    if (frame.tSec < prevTsec) {
      throw new Error(
        `runPlan: frames[${i}].tSec must not be earlier than the previous frame`,
      );
    }
    // Proposal B contract (types.ts): an optional zoneId per frame,
    // one small integer from 0 per physical area. A direct runPlan
    // caller gets the same fail-fast as runSegment instead of
    // silently counting a bad zone id as its own zone.
    if (
      frame.zoneId !== undefined &&
      (!Number.isInteger(frame.zoneId) || frame.zoneId < 0)
    ) {
      throw new Error(
        `runPlan: frames[${i}].zoneId must be a whole number >= 0 when given`,
      );
    }
    // Parity with the route validator (src/lib/pipeline/planRequest.ts):
    // a frame timestamp past durationSec would mislabel that proof
    // frame's time on the plan screen, while the route already fails
    // fast on the same input. A direct runPlan caller gets the same
    // fail-fast here instead of only via the route.
    if (frame.tSec > request.durationSec) {
      throw new Error(
        `runPlan: frames[${i}].tSec must not exceed durationSec`,
      );
    }
    // Parity with the route validator (src/lib/pipeline/planRequest.ts):
    // a frame dataUrl must be a data:image base64 URL carrying a real
    // image header. A bare string (or a text blob re-labelled
    // data:image/jpeg) used to pass here and only surface later, when
    // the segment step skipped and the plan silently lost
    // segmentation. A direct runPlan caller gets the same fail-fast
    // here instead of only via the route.
    if (
      !frame.dataUrl.startsWith("data:image/") ||
      !frame.dataUrl.includes(";base64,")
    ) {
      throw new Error(
        `runPlan: frames[${i}].dataUrl must be a data:image base64 URL`,
      );
    }
    {
      const payload = frame.dataUrl.slice(frame.dataUrl.indexOf(";base64,") + 8);
      if (payload.length === 0 || !isBase64(payload)) {
        throw new Error(
          `runPlan: frames[${i}].dataUrl must carry valid base64 image data`,
        );
      }
      if (!isImageBase64(payload)) {
        throw new Error(
          `runPlan: frames[${i}].dataUrl must carry image data (JPEG, PNG, WebP, or GIF)`,
        );
      }
    }
    prevTsec = frame.tSec;
  });
  for (const field of ["spaceName", "spaceType", "region"] as const) {
    if (request[field] !== undefined && typeof request[field] !== "string") {
      throw new Error(`runPlan: ${field} must be a string when given`);
    }
    // Parity with the route validator (src/lib/pipeline/planRequest.ts):
    // an empty string means "not given", but a spaces-only label would
    // print as a blank label on the plan screen, so a direct runPlan
    // caller gets the same fail-fast here instead of only via the route.
    if (
      typeof request[field] === "string" &&
      request[field].length > 0 &&
      request[field].trim().length === 0
    ) {
      throw new Error(`runPlan: ${field} must not be blank when given`);
    }
  }
  if (request.audioWavBase64 !== undefined && typeof request.audioWavBase64 !== "string") {
    throw new Error("runPlan: audioWavBase64 must be a string when given");
  }
  // Parity with the route validator (src/lib/pipeline/planRequest.ts):
  // an empty string means "not given" (runTranscribe returns no
  // transcript), but a spaces-only string is truthy, so it rides past
  // the no-audio skip into runTranscribe and dies there with a
  // misleading "not a WAV file" error. A direct runPlan caller gets
  // the same fail-fast here instead of only via the route.
  if (
    typeof request.audioWavBase64 === "string" &&
    request.audioWavBase64.length > 0 &&
    request.audioWavBase64.trim().length === 0
  ) {
    throw new Error("runPlan: audioWavBase64 must not be blank when given");
  }
  if (
    request.laborBasis !== undefined &&
    request.laborBasis !== "volunteer" &&
    request.laborBasis !== "contractor" &&
    request.laborBasis !== "mixed"
  ) {
    throw new Error("runPlan: laborBasis must be volunteer, contractor, or mixed when given");
  }
}

/**
 * Run the full pipeline for one request. The segment stage covers both
 * the "looking" and "counting" UI steps (one SAM pass does hazards and
 * counts), so both statuses are emitted around it. A segment failure
 * no longer stops the run: it is logged server-side, looking and
 * counting are reported as skipped on every later running status, and
 * the reason step continues with no segmentation counts, so a blocked
 * SAM step never kills a real plan run (Grok Bot, 2026-10-27 11:20 AM).
 */
export async function runPlan(request: PlanRequest, deps: RunPlanDeps): Promise<WorkPlan> {
  // Optional steps skipped so far this run, in stage order. Attached
  // to every later running status (Grok Bot, 2026-10-27 5:45 PM), so
  // the processing screen can mark them skipped live instead of
  // waiting for the finished plan's meta.skipped. Picturing is last,
  // so its skip has no later running line and still arrives only via
  // the done plan's meta.skipped.
  const skippedSteps: Exclude<PlanStep, "done">[] = [];
  const emit = (step: Exclude<PlanStep, "done">): void => {
    deps.onStatus?.(
      skippedSteps.length > 0
        ? { state: "running", step, skipped: [...skippedSteps] }
        : { state: "running", step },
    );
  };

  // One meta object for both the draft and the final plan, so the
  // engine label never drifts between the two contract checks.
  // Skipped-step flags for the plan screen (Grok Bot, 2026-10-27
  // 12:05 PM): masks when the segment step failed or was skipped
  // (segmentation null), afterImage when the render step produced no
  // image, cost when a regioned cost call failed (Grok Bot,
  // 2026-10-27 2:15 PM; a run with no region sets no cost flag).
  // Callers pass the flags; this helper only assembles them,
  // so no step result is read before it exists.
  const planMeta = (
    masksSkipped: boolean,
    afterImageSkipped: boolean,
    costSkipped = false,
  ): NonNullable<WorkPlan["meta"]> => {
    const skipped: { masks?: boolean; afterImage?: boolean; cost?: boolean } = {};
    if (masksSkipped) skipped.masks = true;
    if (afterImageSkipped) skipped.afterImage = true;
    if (costSkipped) skipped.cost = true;
    return {
      costUsd: deps.tracker.totals().spikeTotalUsd,
      ...(deps.planProvider ? { planProvider: deps.planProvider } : {}),
      ...(Object.keys(skipped).length > 0 ? { skipped } : {}),
    };
  };

  // listening: transcribe the narration, or null when there is none.
  assertNotAborted(deps.signal);
  validateRunPlanDeps(deps);
  validateRunPlanRequest(request);
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
  // Optional like picturing: on a SAM failure, log it, mark masks
  // unavailable (segmentation null), and continue to reason with no
  // segmentation counts instead of failing the run.
  assertNotAborted(deps.signal);
  emit("looking");
  emit("counting");
  let segmentation: Awaited<ReturnType<typeof runSegment>> | null = null;
  try {
    segmentation = await runSegment(
      {
        frames: request.frames.map((f) => ({
          tSec: f.tSec,
          dataUrl: f.dataUrl,
          ...(f.zoneId !== undefined ? { zoneId: f.zoneId } : {}),
        })),
        concurrency: deps.segmentConcurrency,
      },
      deps.segment,
    );
  } catch (err) {
    if (isAbort(err)) throw err;
    // A cap breach is not a SAM failure: stop the run instead of
    // continuing to the reason step, which would spend another call.
    if (isSpikeCapError(err))
      throw new PlanStepError("counting", PLAIN_FAILURE_MESSAGE.counting, detailOf(err));
    console.warn(`runPlan: segment failed, continuing without segmentation: ${detailOf(err)}`);
    segmentation = null;
    // The segment stage covers both UI steps, so both read as
    // skipped from here on; the next running line carries them.
    skippedSteps.push("looking", "counting");
  }

  // comparing: Spark turns frames + segmentation + transcript into
  // issues, materials, and work steps. When the reason step is
  // capped (Baseten mode), it sees only the picked subset, in
  // subset positions, and its output is remapped back to plan
  // frames before assembly; the meta path is untouched.
  assertNotAborted(deps.signal);
  emit("comparing");
  const reasonSubset = deps.reasonMaxFrames
    ? pickReasonFrames(
        request.frames.length,
        segmentation?.flaggedFrames ?? [],
        deps.reasonMaxFrames,
      )
    : null;
  // Segmentation indices are subset positions too, so the prompt's
  // flaggedFrames, hazardHits, and rawLog stay consistent with the
  // subset frame list; entries outside the subset are dropped.
  const reasonSegmentation =
    segmentation && reasonSubset
      ? {
          ...segmentation,
          flaggedFrames: segmentation.flaggedFrames
            .map((f) => reasonSubset.indexOf(f))
            .filter((p) => p >= 0),
          hazardHits: segmentation.hazardHits
            ?.map((hit) => {
              const pos = reasonSubset.indexOf(hit.frameIndex);
              return pos < 0 ? null : { ...hit, frameIndex: pos };
            })
            .filter((hit): hit is NonNullable<typeof hit> => hit !== null),
          rawLog: segmentation.rawLog
            .map((entry) => {
              const pos = reasonSubset.indexOf(entry.frameIndex);
              return pos < 0 ? null : { ...entry, frameIndex: pos };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
        }
      : segmentation;
  let reason;
  try {
    const reasonInput: ReasonInput = {
      frames: (reasonSubset ? reasonSubset.map((i) => request.frames[i]) : request.frames).map(
        (f) => ({ tSec: f.tSec, dataUrl: f.dataUrl }),
      ),
      segmentation: reasonSegmentation,
      transcript,
      spaceName: request.spaceName,
      spaceType: request.spaceType,
      durationSec: request.durationSec,
    };
    const reasonDeps: ReasonDeps = deps.reasonPrompt
      ? { ...deps.reason, prompt: deps.reasonPrompt(reasonInput) }
      : deps.reason;
    const rawReason = await runReason(reasonInput, reasonDeps);
    reason = reasonSubset ? remapReasonOutput(rawReason, reasonSubset) : rawReason;
    if (reason.warnings?.length) {
      console.warn(`runPlan: reason kept with warnings:\n${reason.warnings.join("\n")}`);
    }
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new PlanStepError("comparing", PLAIN_FAILURE_MESSAGE.comparing, detailOf(err));
  }

  // planning: region-grounded cost range (null without a region),
  // then assemble the plan shell the render step edits from.
  // Cost is optional (Grok Bot, 2026-10-27 2:15 PM): when a region
  // was given but the cost call fails, log a server warning, keep
  // costRange null, and set meta.skipped.cost, instead of failing
  // the run. A run with no region sets no flag, and a contract-
  // check failure still fails the run.
  assertNotAborted(deps.signal);
  emit("planning");
  const frames: PlanFrame[] = request.frames.map((f, i) => ({
    index: i,
    tSec: f.tSec,
    url: f.dataUrl,
  }));
  let cost: Awaited<ReturnType<typeof estimateCost>> = null;
  let costSkipped = false;
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
    cost = await estimateCost(costInput, costDeps);
  } catch (err) {
    if (isAbort(err)) throw err;
    // A cap breach is not a cost failure: stop the run instead of
    // continuing to the picturing step, which would spend another call.
    if (isSpikeCapError(err))
      throw new PlanStepError("planning", PLAIN_FAILURE_MESSAGE.planning, detailOf(err));
    // No-region estimateCost returns null without calling, so a throw
    // here is unexpected: keep the old planning failure, don't mask it.
    if (!request.region?.trim()) {
      throw new PlanStepError("planning", PLAIN_FAILURE_MESSAGE.planning, detailOf(err));
    }
    console.warn(`runPlan: cost failed, continuing without cost range: ${detailOf(err)}`);
    costSkipped = true;
    cost = null;
  }
  let draft: WorkPlan;
  try {
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
      meta: planMeta(segmentation === null, false, costSkipped),
    };
    const errs = checkWorkPlan(draft);
    // A reason result kept with warnings (Grok Bot 2026-10-27 9:55 AM)
    // may still fail the attached-frames contract check on those same
    // fields; those errors are logged, not thrown. Any error not
    // explained by a reason warning still fails the run.
    const unexplained = errs.filter((e) => !explainedByReasonWarnings(e, reason.warnings ?? []));
    if (unexplained.length > 0) {
      throw new Error(`runPlan: plan failed contract check:\n${unexplained.join("\n")}`);
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
    meta: planMeta(segmentation === null, rendered.skipped !== undefined, costSkipped),
  };
  const errs = checkWorkPlan(plan);
  const unexplained = errs.filter((e) => !explainedByReasonWarnings(e, reason.warnings ?? []));
  if (unexplained.length > 0) {
    throw new PlanStepError(
      "planning",
      PLAIN_FAILURE_MESSAGE.planning,
      `runPlan: final plan failed contract check:\n${unexplained.join("\n")}`,
    );
  }
  return plan;
}

