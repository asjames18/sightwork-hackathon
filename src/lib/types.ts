/**
 * SightWork plan output format: the shared contract between the frame
 * sampler, the Meta pipeline (src/lib/pipeline, src/lib/meta), the API
 * routes, and the UI. Mock data and the real pipeline must both match it.
 *
 * Conventions
 * - Times are seconds from the start of the video (`...Sec`).
 * - `frameIndex` is the position in the plan's `frames` array (0-based),
 *   which is also the order frames are attached to the reasoning call.
 * - Boxes are normalized 0-1000 as [x1, y1, x2, y2] (Muse Spark / SAM style).
 * - Money is USD. Every cost is an estimate and carries its label.
 */

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

export type Box = [x1: number, y1: number, x2: number, y2: number];

/** Why the sampler kept a frame. */
export type FrameReason = "interval" | "scene";

/** One still frame from the walkthrough. */
export interface PlanFrame {
  /** 0-based position in `WorkPlan.frames`. */
  index: number;
  /** Seconds into the video. */
  tSec: number;
  /** Image URL (http(s), relative, or data: URL). */
  url: string;
  reason?: FrameReason;
}

/** A pointer to a frame that proves something, with an optional box. */
export interface FrameRef {
  frameIndex: number;
  tSec: number;
  box?: Box;
  /** Short caption, e.g. "cable across center aisle". */
  caption?: string;
}

/** One entry in the frame sampler's manifest.json (tools/frames). */
export interface SampledFrame {
  index: number;
  tSec: number;
  /** File name relative to the manifest, e.g. "f003_t000012.40s.jpg". */
  file: string;
  reason: FrameReason;
  /** Scene-change score 0-1 when reason is "scene". */
  sceneScore?: number;
}

/** tools/frames output: manifest.json next to the sampled JPEGs. */
export interface FrameManifest {
  source: string;
  durationSec: number;
  generatedAt: string;
  settings: { intervalSec: number; sceneThreshold: number; minGapSec: number; maxFrames: number; longSidePx: number };
  frames: SampledFrame[];
}

// ---------------------------------------------------------------------------
// Request (what the browser / CLI sends to the pipeline)
// ---------------------------------------------------------------------------

export interface PlanRequest {
  spaceName?: string;
  /** e.g. "church sanctuary". Defaults to "church sanctuary". */
  spaceType?: string;
  durationSec: number;
  frames: { tSec: number; dataUrl: string }[];
  /** Narration as base64 WAV (mono, 16-bit PCM, 16 or 24 kHz). */
  audioWavBase64?: string;
  /** Region for cost estimates, e.g. "Sebring, FL". Omit it and costRange is null. */
  region?: string;
  laborBasis?: LaborBasis;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface TranscriptTurn {
  startSec: number;
  endSec?: number;
  text: string;
}

export interface InventoryItem {
  label: string;
  count: number;
  /** 0-1. */
  confidence: number;
  /** Low-high when SAM and the reasoning model disagree by more than 20%. */
  range?: [low: number, high: number];
  method?: "sam" | "model" | "sam+model";
  zone?: string;
}

export type Severity = "high" | "medium" | "low";

export type IssueCategory = "safety" | "damage" | "function" | "cosmetic";

/** Said vs. seen: did the speaker mention it, and does the video show it? */
export type SaidVsSeenStatus = "mentioned" | "unmentioned" | "mentioned_not_seen";

export type HazardKey =
  | "egress"
  | "trip_cable"
  | "water_stain"
  | "exposed_wiring"
  | "damaged_seating"
  | "fire_extinguisher"
  | "ada_path"
  | "power_strip";

/** A ranked problem. rank 1 is the most important. */
export interface Issue {
  rank: number;
  title: string;
  detail: string;
  severity: Severity;
  /** Primary proof frame. */
  frameIndex: number;
  frameTimeSec: number;
  /** True when the video shows it and the narration never mentioned it. */
  unmentioned: boolean;
  status?: SaidVsSeenStatus;
  /** What the speaker said, when status is "mentioned" or "mentioned_not_seen". */
  mention?: { quote: string; saidAtSec: number } | null;
  /** All proof frames (includes frameIndex). At least 1 when unmentioned. */
  proofFrames?: FrameRef[];
  /** 0-1. The pipeline drops anything under 0.5 before it reaches the UI. */
  confidence?: number;
  category?: IssueCategory;
  hazard?: HazardKey;
}

export interface MaterialItem {
  item: string;
  /** Quantity with units, e.g. "2", "1 roll", "12 chairs". */
  qty: string;
  note?: string;
  /** Estimated cost per unit, low/high USD. Estimate only. */
  unitCost?: [low: number, high: number];
  /** Ranks of the issues this material fixes. */
  forIssues?: number[];
}

export interface WorkStep {
  /** 1-based, in the order the work must happen. */
  order: number;
  title: string;
  detail: string;
  /** order of an earlier step that must finish first. */
  dependsOn?: number;
  /** Ranks of the issues this step fixes. */
  fixes?: number[];
  trade?: string;
  hours?: [low: number, high: number];
}

export type LaborBasis = "volunteer" | "contractor" | "mixed";

export const COST_LABEL = "Rough estimate, not a quote" as const;
export const AFTER_IMAGE_LABEL = "AI concept, not a render" as const;

export interface CostRange {
  low: number;
  high: number;
  currency: "USD";
  label: typeof COST_LABEL;
  /** Region used for prices and labor, e.g. "Sebring, FL". Never assumed silently. */
  region: string;
  laborBasis: LaborBasis;
  /** Mid-grade materials, contingency %, and anything else assumed. */
  assumptions: string[];
  /** Real, citable sources only. Omit when ungrounded. */
  sources?: { title: string; url: string }[];
}

/** One row of the said-vs-seen comparison shown to the user. */
export interface SaidVsSeenEntry {
  status: SaidVsSeenStatus;
  /** What was said (null for unmentioned). */
  said: { quote: string; atSec: number } | null;
  /** What the video shows (null for mentioned_not_seen). */
  seen: { summary: string; frameIndex: number } | null;
  /** Rank of the matching issue, if any. */
  issueRank?: number;
}

/** The full work plan. */
export interface WorkPlan {
  spaceName: string;
  /** e.g. "Walkthrough video, 24 frames, 78 s, narrated". */
  generatedFrom: string;
  inventory: InventoryItem[];
  /** Sorted by rank ascending. */
  issues: Issue[];
  materials: MaterialItem[];
  /** Sorted by order ascending. */
  workOrder: WorkStep[];
  /** Muse Image render of the finished space. null = not generated. */
  afterImageUrl: string | null;
  /** Raw transcript, one turn per line as "[12.4] text". null = no narration. */
  transcript: string | null;

  /** Frames that frameIndex values point into. */
  frames?: PlanFrame[];
  transcriptTurns?: TranscriptTurn[];
  /** One or two sentences: what the speaker asked for. */
  transcriptSummary?: string | null;
  saidVsSeen?: SaidVsSeenEntry[];
  /** null when no region was supplied. */
  costRange?: CostRange | null;
  /** Frame the after image was rendered from. */
  heroFrameIndex?: number;
  afterImageLabel?: typeof AFTER_IMAGE_LABEL;
  meta?: {
    models?: Record<string, string>;
    costUsd?: number;
    durationSec?: number;
    isExample?: boolean;
    /** Which engine wrote the plan (reason + work order). Omitted = Meta Muse Spark. */
    planProvider?: PlanProvider;
    /** Optional steps that did not run this time (e.g. Meta model access off). The plan is still complete. */
    skipped?: { masks?: boolean; afterImage?: boolean };
  };
}

/** Where the plan step runs: Meta Model API (Muse Spark) or Muse Spark Open on Baseten. */
export type PlanProvider = "meta" | "baseten";

/**
 * True when this plan's outlines and counts came from SAM. False when the masks step was skipped
 * or failed. Boxes alone don't count: the reason model can draw its own boxes when SAM is off.
 */
export function masksAvailable(plan: WorkPlan): boolean {
  if (plan.meta?.skipped?.masks) return false;
  return plan.inventory.some((i) => i.method === "sam" || i.method === "sam+model");
}

/** UI step labels while a plan is being made. */
export type PlanStep = "uploading" | "listening" | "looking" | "counting" | "comparing" | "planning" | "picturing" | "done";

/** Steps the processing screen shows, in order ("done" is not shown). */
export const PLAN_STEPS: Exclude<PlanStep, "done">[] = ["uploading", "listening", "looking", "counting", "comparing", "planning", "picturing"];

/**
 * Progress of one plan job as the UI sees it. A failed step carries a plain message
 * (no provider error text); the processing screen shows it as-is.
 */
export type PlanJobStatus =
  | { state: "running"; step: Exclude<PlanStep, "done"> }
  | { state: "done"; plan: WorkPlan }
  | { state: "failed"; step: Exclude<PlanStep, "done">; message: string };

// ---------------------------------------------------------------------------
// Contract checks (no dependencies). Returns a list of problems; [] = valid.
// ---------------------------------------------------------------------------

export function checkWorkPlan(plan: WorkPlan): string[] {
  const errs: string[] = [];
  const nFrames = plan.frames?.length;
  const inFrames = (i: number) => Number.isInteger(i) && i >= 0 && (nFrames === undefined || i < nFrames);

  plan.issues.forEach((issue, i) => {
    if (issue.rank !== i + 1) errs.push(`issues[${i}].rank is ${issue.rank}, expected ${i + 1}`);
    if (!inFrames(issue.frameIndex)) errs.push(`issues[${i}].frameIndex ${issue.frameIndex} out of range`);
    if (plan.frames && plan.frames[issue.frameIndex] && plan.frames[issue.frameIndex].tSec !== issue.frameTimeSec)
      errs.push(`issues[${i}].frameTimeSec does not match frames[${issue.frameIndex}].tSec`);
    if (issue.status && (issue.status === "unmentioned") !== issue.unmentioned)
      errs.push(`issues[${i}] status/unmentioned disagree`);
    if (issue.unmentioned && issue.proofFrames && issue.proofFrames.length === 0)
      errs.push(`issues[${i}] is unmentioned but has no proof frames`);
    issue.proofFrames?.forEach((f, j) => {
      if (!inFrames(f.frameIndex)) errs.push(`issues[${i}].proofFrames[${j}] out of range`);
    });
    if (issue.confidence !== undefined && (issue.confidence < 0 || issue.confidence > 1))
      errs.push(`issues[${i}].confidence must be 0-1`);
  });

  plan.workOrder.forEach((step, i) => {
    if (step.order !== i + 1) errs.push(`workOrder[${i}].order is ${step.order}, expected ${i + 1}`);
    if (step.dependsOn !== undefined && !(step.dependsOn >= 1 && step.dependsOn < step.order))
      errs.push(`workOrder[${i}].dependsOn must point to an earlier step`);
  });

  plan.inventory.forEach((item, i) => {
    if (!Number.isInteger(item.count) || item.count < 0) errs.push(`inventory[${i}].count must be a whole number`);
    if (item.range && !(item.range[0] <= item.count && item.count <= item.range[1]))
      errs.push(`inventory[${i}].range must contain count`);
  });

  const c = plan.costRange;
  if (c) {
    if (!(c.low >= 0 && c.low <= c.high)) errs.push("costRange.low must be 0..high");
    if (c.label !== COST_LABEL) errs.push(`costRange.label must be "${COST_LABEL}"`);
    if (!c.region.trim()) errs.push("costRange.region is required");
  }

  if (plan.heroFrameIndex !== undefined && !inFrames(plan.heroFrameIndex)) errs.push("heroFrameIndex out of range");
  plan.saidVsSeen?.forEach((row, i) => {
    if (row.seen && !inFrames(row.seen.frameIndex)) errs.push(`saidVsSeen[${i}].seen.frameIndex out of range`);
    if (row.status === "unmentioned" && row.said) errs.push(`saidVsSeen[${i}] is unmentioned but has a quote`);
    if (row.status === "mentioned_not_seen" && row.seen) errs.push(`saidVsSeen[${i}] is not seen but has a frame`);
  });
  return errs;
}
