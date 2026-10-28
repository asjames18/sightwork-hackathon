/**
 * SightWork pipeline step: `segment`.
 *
 * Runs the SAM 3.1 concept list from prompt 02 in the planning repo
 * over the sampled frames and turns the masks
 * into the segmentation result the reason step consumes. SAM is
 * prompted with short noun phrases, not instructions, so the "prompt"
 * here is the concept list plus the aggregation rules from prompt 02.
 *
 * This module makes no API calls and holds no keys. The SAM caller is
 * injected by the wiring code (later: src/lib/meta), so the step is
 * testable on mock data and the spike can swap callers without
 * touching this logic. Every would-be call is recorded on the usage
 * tracker from ./usage.ts, so the $10 spike cap is enforced in code.
 *
 * Aggregation rules (prompt 02, enforced here, not trusted to the
 * model):
 * - Request budget (rule 1, rewritten Oct 26): hazards get 60% of
 *   the cap on evenly spaced frames, scene-change frames first
 *   (22 by default); counts run on an evenly spaced subset of those
 *   hazard frames (17 by default). Short videos whose frames x
 *   hazard concepts fit in 60% of the cap get hazards on every
 *   frame and the count pass takes the rest, as before.
 * - If the count pass still gets fewer than 6 frames, drop plants,
 *   then screens, before shrinking the hazard share. budgetExceeded
 *   is set only when the split had to drop concepts.
 * - "exit sign" is in both lists, so it is run once (in the hazard
 *   pass) and the result is reused for the count pass; no second call.
 * - Counts are never summed across frames (frames overlap as the
 *   camera pans). For each concept, count = the max instance count
 *   seen in any single frame; confidence = the mean SAM score of the
 *   instances in that frame, rounded to 2 decimals. A label whose max
 *   count is 0 is omitted.
 * - flaggedFrames = sorted, unique indices of frames with at least
 *   one hazard-concept instance at or above minScore.
 * - hazardHits = for each flagged frame and hazard key, the
 *   best-scoring instance's box, when it has one. reason.ts does not
 *   consume hazardHits yet; they are carried here so the reason step
 *   can reuse them as proofFrames[].box later without a new call.
 * - The per-frame raw results are returned as rawLog for the
 *   server-side debug log. They never go into WorkPlan.
 *
 * The result type is SegmentationResult from ./reason.ts, extended
 * with the optional hazardHits and the run diagnostics, so a segment
 * output can be handed straight to runReason.
 */

import type { Box, HazardKey } from "../types";
import type { SegmentationResult } from "./reason";
import type { UsageTracker } from "./usage";

/** Model ID from prompt 02; confirm it at the first spike. */
export const SAM_MODEL = "sam-3.1";

/** Instance score threshold from prompt 02. Drop instances below it. */
export const DEFAULT_MIN_SCORE = 0.5;

/** Request cap per plan from prompt 02 (one request = one concept on one frame). */
export const DEFAULT_MAX_SAM_REQUESTS = 300;

/** One SAM concept: the noun phrase sent to the model and its output label. */
export interface CountConcept {
  /** Noun phrase sent to SAM, e.g. "folding table". */
  prompt: string;
  /** Label shown in counts[] and the UI, e.g. "Folding tables". */
  label: string;
}

/** One hazard concept: the noun phrase sent to SAM and the key it flags. */
export interface HazardConcept {
  /** Noun phrase sent to SAM, e.g. "cable on floor". */
  prompt: string;
  /** HazardKey reason uses to decide whether a real issue exists. */
  hazard: HazardKey;
}

/** Default count concepts from prompt 02, in output order. */
export const COUNT_CONCEPTS: CountConcept[] = [
  { prompt: "chair", label: "Chairs" },
  { prompt: "folding table", label: "Folding tables" },
  { prompt: "ceiling light fixture", label: "Ceiling light fixtures" },
  { prompt: "exit sign", label: "Exit signs" },
  { prompt: "loudspeaker", label: "Speakers" },
  { prompt: "projection screen", label: "Screens" },
  { prompt: "potted plant", label: "Plants" },
  { prompt: "stage platform", label: "Stage platform sections" },
];

/** Default hazard concepts from prompt 02. */
export const HAZARD_CONCEPTS: HazardConcept[] = [
  { prompt: "cable on floor", hazard: "trip_cable" },
  { prompt: "extension cord", hazard: "trip_cable" },
  { prompt: "power strip", hazard: "power_strip" },
  { prompt: "water stain", hazard: "water_stain" },
  { prompt: "exposed wire", hazard: "exposed_wiring" },
  { prompt: "torn chair upholstery", hazard: "damaged_seating" },
  { prompt: "fire extinguisher", hazard: "fire_extinguisher" },
  { prompt: "exit sign", hazard: "egress" },
];

/**
 * Concepts dropped from the count pass to fit the request cap, in the
 * order prompt 02 drops them: plants first, then screens. A drop only
 * counts when it actually buys a count pass; otherwise the count pass
 * is skipped and nothing is dropped.
 */
export const COUNT_DROP_ORDER: string[] = ["Plants", "Screens"];

/** One SAM instance as the caller returns it (unknown shape, validated here). */
export interface RawInstance {
  /** SAM instance score, 0-1. */
  score: number;
  /** Box already normalized to 0-1000 [x1, y1, x2, y2]; the SAM caller normalizes pixels. */
  box?: Box;
}

/** A model call supplied by the wiring code. Never a real call in tests. */
export interface SegmentCaller {
  (req: {
    model: string;
    /** Noun-phrase concept, e.g. "chair". */
    concept: string;
    /** Index into the plan's frames array. */
    frameIndex: number;
    /** Data URL of the still image. */
    dataUrl: string;
  }): Promise<{ instances: unknown; latencyMs: number; costUsd: number }>;
}

/** One frame handed to the segment step, in array order. */
export interface SegmentFrame {
  tSec: number;
  /** Data URL of the still image, attached to the model call in order. */
  dataUrl: string;
}

export interface SegmentInput {
  frames: SegmentFrame[];
  /** Indices of scene-change frames, kept first in the count subset. */
  sceneFrameIndices?: number[];
  minScore?: number;
  maxRequests?: number;
}

/** One hazard hit: the best instance for a hazard key on a frame. */
export interface HazardHit {
  frameIndex: number;
  hazard: HazardKey;
  score: number;
  box: Box;
}

/** One per-frame raw result, for the server-side debug log only. */
export interface SegmentRawEntry {
  concept: string;
  frameIndex: number;
  /** Instances at or above minScore. */
  count: number;
  boxes: Box[];
  scores: number[];
}

/** Segment output: the reason step's input, plus run diagnostics. */
export interface SegmentOutput extends SegmentationResult {
  /** Best-scoring hazard instance per frame and hazard key (box required). */
  hazardHits?: HazardHit[];
  /** Per-frame raw results; debug log only, never part of WorkPlan. */
  rawLog: SegmentRawEntry[];
  /** Count labels dropped to fit the request cap (empty when none). */
  droppedLabels: string[];
  /** Actual SAM calls made (reused "exit sign" results are not re-called). */
  requestsMade: number;
  /** True when the split had to drop concepts (or the cap fits no hazard frame). */
  budgetExceeded: boolean;
}

export interface SegmentDeps {
  callSegment: SegmentCaller;
  tracker: UsageTracker;
}

/** Validate raw SAM output into instances, dropping nothing here (threshold applied by callers). */
export function parseInstances(raw: unknown, concept: string, frameIndex: number): RawInstance[] {
  if (!Array.isArray(raw)) {
    throw new Error(`segment: SAM output for "${concept}" on frame ${frameIndex} is not an instance array`);
  }
  const out: RawInstance[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i] as Record<string, unknown>;
    if (t === null || typeof t !== "object" || Array.isArray(t)) {
      throw new Error(`segment: instance ${i} for "${concept}" on frame ${frameIndex} is not an object`);
    }
    if (typeof t.score !== "number" || !Number.isFinite(t.score) || t.score < 0 || t.score > 1) {
      throw new Error(`segment: instance ${i} for "${concept}" on frame ${frameIndex} has no valid score`);
    }
    let box: Box | undefined;
    if (t.box !== undefined) {
      if (
        !Array.isArray(t.box) ||
        t.box.length !== 4 ||
        t.box.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1000)
      ) {
        throw new Error(`segment: instance ${i} for "${concept}" on frame ${frameIndex} has no valid 0-1000 box`);
      }
      const [x1, y1, x2, y2] = (t.box as number[]).map((v) => Math.round(v));
      if (x1 > x2 || y1 > y2) {
        throw new Error(`segment: instance ${i} for "${concept}" on frame ${frameIndex} has an inverted box`);
      }
      box = [x1, y1, x2, y2];
    }
    out.push(box === undefined ? { score: t.score } : { score: t.score, box });
  }
  return out;
}

export interface SegmentPlan {
  /** Hazard-pass frames: 60% of the cap, evenly spaced, scene-change frames first. */
  hazardFrames: number[];
  /** Count-pass frames: an evenly spaced subset of hazardFrames. */
  countFrames: number[];
  /** Count labels dropped to fit the cap (empty when none). */
  droppedLabels: string[];
  /** Planned SAM calls, counting the shared "exit sign" once. */
  requestsPlanned: number;
  /** True when the split had to drop concepts (or the cap fits no hazard frame). */
  budgetExceeded: boolean;
}

function dedupePrompts(prompts: string[]): string[] {
  return [...new Set(prompts)];
}

function validateSceneIndices(indices: number[], frameCount: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const i of indices) {
    if (!Number.isInteger(i) || i < 0 || i >= frameCount) {
      throw new Error(`segment: scene frame index ${i} is out of range for ${frameCount} frames`);
    }
    if (!seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  }
  return out.sort((a, b) => a - b);
}

/** Evenly spaced picks from candidates, up to count, in ascending order. */
function evenlySpaced(candidates: number[], count: number): number[] {
  if (count <= 0 || candidates.length === 0) return [];
  if (count >= candidates.length) return [...candidates];
  const picked: number[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(candidates[Math.floor((i * candidates.length) / count)]);
  }
  return [...new Set(picked)].sort((a, b) => a - b);
}

/**
 * Plan the SAM request budget for a frame count (prompt 02, rule 1).
 * Hazards get 60% of the cap on evenly spaced frames, scene-change
 * frames first; counts run on an evenly spaced subset of those
 * hazard frames. When frames x hazard prompts fits in 60% of the
 * cap, hazards run on every frame and the count pass takes the
 * rest, as before. If the count pass still gets fewer than 6
 * frames, drop plants, then screens, before shrinking the hazard
 * share. budgetExceeded is set only when the split had to drop
 * concepts (or the cap fits no hazard frame at all).
 */
export function planSegmentFrames(opts: {
  frameCount: number;
  sceneFrameIndices?: number[];
  maxRequests?: number;
}): SegmentPlan {
  const frameCount = opts.frameCount;
  const maxRequests = opts.maxRequests ?? DEFAULT_MAX_SAM_REQUESTS;
  if (!Number.isInteger(frameCount) || frameCount < 0) {
    throw new Error(`segment: frameCount must be a whole number >= 0, got ${frameCount}`);
  }
  if (!Number.isInteger(maxRequests) || maxRequests < 0) {
    throw new Error(`segment: maxRequests must be a whole number >= 0, got ${maxRequests}`);
  }
  const scene = validateSceneIndices(opts.sceneFrameIndices ?? [], frameCount);
  const allFrames = Array.from({ length: frameCount }, (_, i) => i);

  const hazardPrompts = dedupePrompts(HAZARD_CONCEPTS.map((c) => c.prompt));
  const countPrompts = dedupePrompts(COUNT_CONCEPTS.map((c) => c.prompt));
  const shared = new Set(hazardPrompts.filter((p) => countPrompts.includes(p)));
  // Incremental count prompts exclude prompts already run in the hazard pass.
  const incrementalCount = (droppedLabels: string[]): number =>
    COUNT_CONCEPTS.filter(
      (c) => !shared.has(c.prompt) && !droppedLabels.includes(c.label),
    ).length;

  // Scene-change frames first, then evenly spaced fills up to count.
  const pickFrames = (count: number): number[] => {
    const rest = allFrames.filter((i) => !scene.includes(i));
    const fill = evenlySpaced(rest, Math.max(0, count - scene.length));
    return [...scene.slice(0, count), ...fill]
      .sort((a, b) => a - b)
      .slice(0, count);
  };

  // Hazard share: 60% of the cap. A short video (frames x hazards
  // fits in 60%) keeps hazards on every frame via the min().
  let hazardFrames = pickFrames(
    Math.min(frameCount, Math.floor((0.6 * maxRequests) / hazardPrompts.length)),
  );
  if (frameCount > 0 && hazardFrames.length === 0) {
    // Degenerate cap: no hazard frame fits the 60% share, so run
    // nothing rather than blow the cap; the caller reports it.
    return {
      hazardFrames: [],
      countFrames: [],
      droppedLabels: [],
      requestsPlanned: 0,
      budgetExceeded: true,
    };
  }
  let hazardRequests = hazardPrompts.length * hazardFrames.length;

  // Count pass on an evenly spaced subset of the hazard frames.
  // Reusing "exit sign" means it is never run twice on one frame.
  const countFramesFor = (droppedLabels: string[]): number => {
    const n = incrementalCount(droppedLabels);
    if (n === 0) return hazardFrames.length;
    return Math.min(
      hazardFrames.length,
      Math.floor((maxRequests - hazardRequests) / n),
    );
  };

  let droppedLabels: string[] = [];
  let countBudget = countFramesFor([]);
  // Fewer than 6 count frames, on a video with at least 6 frames:
  // drop plants, then screens, keeping a drop only when it actually
  // buys count frames. A shorter video already counts on every
  // frame, so there is nothing to fix and nothing is dropped.
  if (countBudget < 6 && frameCount >= 6) {
    for (const drop of [["Plants"], ["Plants", "Screens"]]) {
      const n = countFramesFor(drop);
      if (n > countBudget) {
        droppedLabels = drop;
        countBudget = n;
      }
      if (countBudget >= 6) break;
    }
    // Still fewer than 6: shrink the hazard share until the count
    // pass fits, or hazard frames run out.
    while (countBudget < 6 && hazardFrames.length > 1) {
      hazardFrames = pickFrames(hazardFrames.length - 1);
      hazardRequests = hazardPrompts.length * hazardFrames.length;
      countBudget = countFramesFor(droppedLabels);
    }
  }
  const countFrames = evenlySpaced(hazardFrames, countBudget);

  return {
    hazardFrames,
    countFrames,
    droppedLabels,
    requestsPlanned:
      hazardRequests + incrementalCount(droppedLabels) * countFrames.length,
    budgetExceeded: droppedLabels.length > 0,
  };
}

/** Validate the segment step's request before any paid SAM call. */
export function validateSegmentInput(input: SegmentInput): void {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("segment: input is not an object");
  }
  if (!Array.isArray(input.frames)) {
    throw new Error("segment: frames is not an array");
  }
  const minScore = input.minScore ?? DEFAULT_MIN_SCORE;
  if (typeof minScore !== "number" || !Number.isFinite(minScore) || minScore < 0 || minScore > 1) {
    throw new Error(`segment: minScore must be 0-1, got ${minScore}`);
  }
  if (
    input.maxRequests !== undefined &&
    (!Number.isInteger(input.maxRequests) || input.maxRequests < 0)
  ) {
    throw new Error(`segment: maxRequests must be a whole number >= 0, got ${input.maxRequests}`);
  }
  if (input.sceneFrameIndices !== undefined) {
    if (
      !Array.isArray(input.sceneFrameIndices) ||
      input.sceneFrameIndices.some((i) => !Number.isInteger(i))
    ) {
      throw new Error("segment: sceneFrameIndices is not an array of integers");
    }
  }
  for (let i = 0; i < input.frames.length; i++) {
    const f = input.frames[i];
    if (
      f === null ||
      typeof f !== "object" ||
      typeof f.tSec !== "number" ||
      !Number.isFinite(f.tSec) ||
      f.tSec < 0 ||
      typeof f.dataUrl !== "string" ||
      f.dataUrl.trim().length === 0
    ) {
      throw new Error(`segment: frame ${i} has no valid tSec/dataUrl`);
    }
  }
}

/** Validate the segment step's call deps before any paid SAM call. */
export function validateSegmentDeps(deps: SegmentDeps): void {
  if (deps === null || typeof deps !== "object" || Array.isArray(deps)) {
    throw new Error("segment: deps is not an object");
  }
  if (typeof deps.callSegment !== "function") {
    throw new Error("segment: callSegment is not a function");
  }
  if (
    deps.tracker === null ||
    typeof deps.tracker !== "object" ||
    typeof deps.tracker.record !== "function"
  ) {
    throw new Error("segment: tracker.record is not a function");
  }
}

export async function runSegment(
  input: SegmentInput,
  deps: SegmentDeps,
): Promise<SegmentOutput> {
  validateSegmentInput(input);
  const minScore = input.minScore ?? DEFAULT_MIN_SCORE;

  const plan = planSegmentFrames({
    frameCount: input.frames.length,
    sceneFrameIndices: input.sceneFrameIndices,
    maxRequests: input.maxRequests,
  });
  if (input.frames.length === 0) {
    return {
      counts: [],
      flaggedFrames: [],
      hazardHits: [],
      rawLog: [],
      droppedLabels: [],
      requestsMade: 0,
      budgetExceeded: false,
    };
  }
  // After the no-frames skip but before the first SAM call, so a bad
  // tracker no longer throws only after a paid call, when record runs.
  validateSegmentDeps(deps);

  const rawLog: SegmentRawEntry[] = [];
  let requestsMade = 0;
  // Keyed "prompt|frameIndex": the hazard pass fills it, the count pass reuses it.
  const results = new Map<string, RawInstance[]>();

  const call = async (concept: string, frameIndex: number): Promise<RawInstance[]> => {
    const res = await deps.callSegment({
      model: SAM_MODEL,
      concept,
      frameIndex,
      dataUrl: input.frames[frameIndex].dataUrl,
    });
    // The tracker enforces the spike cap: a throw here stops the run.
    deps.tracker.record({
      model: SAM_MODEL,
      step: "segment",
      latencyMs: res.latencyMs,
      costUsd: res.costUsd,
    });
    requestsMade += 1;
    const kept = parseInstances(res.instances, concept, frameIndex).filter(
      (inst) => inst.score >= minScore,
    );
    results.set(`${concept}|${frameIndex}`, kept);
    rawLog.push({
      concept,
      frameIndex,
      count: kept.length,
      boxes: kept.flatMap((inst) => (inst.box === undefined ? [] : [inst.box])),
      scores: kept.map((inst) => inst.score),
    });
    return kept;
  };

  // Hazard pass: every unique hazard prompt on every frame.
  const hazardPrompts = dedupePrompts(HAZARD_CONCEPTS.map((c) => c.prompt));
  for (const prompt of hazardPrompts) {
    for (const frameIndex of plan.hazardFrames) {
      await call(prompt, frameIndex);
    }
  }

  // Count pass: surviving count concepts on the planned subset, reusing
  // any prompt already run in the hazard pass ("exit sign").
  const activeCounts = COUNT_CONCEPTS.filter((c) => !plan.droppedLabels.includes(c.label));
  const perConcept = new Map<string, { frameIndex: number; count: number; scores: number[] }>();
  for (const concept of activeCounts) {
    for (const frameIndex of plan.countFrames) {
      const key = `${concept.prompt}|${frameIndex}`;
      const kept = results.has(key)
        ? (results.get(key) as RawInstance[])
        : await call(concept.prompt, frameIndex);
      const prev = perConcept.get(concept.label);
      // Max-per-frame floor; ties keep the earliest frame.
      if (prev === undefined || kept.length > prev.count) {
        perConcept.set(concept.label, {
          frameIndex,
          count: kept.length,
          scores: kept.map((inst) => inst.score),
        });
      }
    }
  }

  const counts = activeCounts
    .map((concept) => {
      const best = perConcept.get(concept.label);
      if (best === undefined || best.count === 0) return null;
      const mean = best.scores.reduce((a, b) => a + b, 0) / best.scores.length;
      return {
        label: concept.label,
        count: best.count,
        confidence: Math.round(mean * 100) / 100,
      };
    })
    .filter((c) => c !== null);

  // Hazard aggregation: best instance per frame and hazard key.
  const flagged = new Set<number>();
  const bestHit = new Map<string, HazardHit>();
  const hazardOrder = new Map<HazardKey, number>();
  HAZARD_CONCEPTS.forEach((c, i) => {
    if (!hazardOrder.has(c.hazard)) hazardOrder.set(c.hazard, i);
  });
  for (const concept of HAZARD_CONCEPTS) {
    for (const frameIndex of plan.hazardFrames) {
      const kept = results.get(`${concept.prompt}|${frameIndex}`) ?? [];
      if (kept.length === 0) continue;
      flagged.add(frameIndex);
      const best = kept.reduce((a, b) => (b.score > a.score ? b : a));
      if (best.box === undefined) continue;
      const key = `${frameIndex}|${concept.hazard}`;
      const prev = bestHit.get(key);
      if (prev === undefined || best.score > prev.score) {
        bestHit.set(key, {
          frameIndex,
          hazard: concept.hazard,
          score: best.score,
          box: best.box,
        });
      }
    }
  }
  const hazardHits = [...bestHit.values()].sort(
    (a, b) =>
      a.frameIndex - b.frameIndex ||
      (hazardOrder.get(a.hazard) ?? 0) - (hazardOrder.get(b.hazard) ?? 0),
  );

  return {
    counts,
    flaggedFrames: [...flagged].sort((a, b) => a - b),
    hazardHits,
    rawLog,
    droppedLabels: plan.droppedLabels,
    requestsMade,
    budgetExceeded: plan.budgetExceeded,
  };
}
