/**
 * SightWork pipeline step: `reason`.
 *
 * Takes the sampled frames, the SAM segmentation result, and the
 * narration transcript, and turns them into the ranked-issues / work-plan
 * part of a WorkPlan (prompt 03 in the planning repo, owned by Grok Bot).
 *
 * This module makes no API calls and holds no keys. The model caller is
 * injected by the wiring code (later: src/lib/meta), so the step is
 * testable on mock data and the spike can swap callers without touching
 * this logic. Every would-be call is recorded on the usage tracker from
 * ./usage.ts, so the $10 spike cap is enforced in code.
 *
 * Prompt and schema are injected too: Grok Bot owns them, and they live
 * in the planning repo, not here. The schema is normalized before it is
 * sent: local `#/$defs/*` references are inlined, because structured
 * output may not accept `$ref`. `anyOf` is passed through as written;
 * if the provider rejects it, the caller surfaces that error verbatim
 * and the step fails loudly instead of guessing.
 *
 * Post-processing (all in the prompt file, enforced here, not trusted
 * to the model):
 * - drop issues with confidence < 0.5; an unmentioned issue needs >= 0.6
 * - re-number ranks 1..n with no gaps, remapping every rank reference
 *   (materials forIssues, workOrder fixes, saidVsSeen issueRank)
 * - drop saidVsSeen rows for dropped issues
 * - drop total/subtotal inventory rows whose count equals the sum of the
 *   same base label's zone rows (prompt 03 rule 7; IMG_9140 double-count guard)
 * - validate with checkWorkPlan from ../types, plus a frameTimeSec check
 *   against the input frames. On failure, retry once with the errors
 *   appended to the prompt, then fail the step.
 */

import {
  checkWorkPlan,
  type InventoryItem,
  type Issue,
  type MaterialItem,
  type SaidVsSeenEntry,
  type WorkPlan,
  type WorkStep,
} from "../types";
import type { UsageTracker } from "./usage";

/** SAM segmentation result, per prompt 02. Counts are per-frame maxima. */
export interface SegmentationResult {
  counts: { label: string; count: number; confidence: number }[];
  /** Sorted, unique frame indices with a hazard-concept instance. */
  flaggedFrames: number[];
}

/** One frame handed to the reason step, in array order. */
export interface ReasonFrame {
  tSec: number;
  /** Data URL of the still image, attached to the model call in order. */
  dataUrl: string;
}

export interface ReasonInput {
  frames: ReasonFrame[];
  segmentation: SegmentationResult;
  /** Transcript string, or null when there is no narration. */
  transcript: string | null;
  spaceName?: string;
  spaceType?: string;
  durationSec: number;
}

/** The part of WorkPlan this step fills. */
export interface ReasonOutput {
  spaceName: string;
  generatedFrom: string;
  inventory: InventoryItem[];
  issues: Issue[];
  materials: MaterialItem[];
  workOrder: WorkStep[];
  transcriptSummary: string | null;
  saidVsSeen: SaidVsSeenEntry[];
  heroFrameIndex: number;
}

/** A model call supplied by the wiring code. Never a real call in tests. */
export interface SparkCaller {
  (req: {
    model: string;
    prompt: string;
    images: string[];
    schema: Record<string, unknown>;
  }): Promise<{ json: unknown; latencyMs: number; costUsd: number }>;
}

export interface ReasonDeps {
  /** Prompt text (prompt 03), with placeholders already filled. */
  prompt: string;
  /** Structured-output schema (prompt 03). Normalized before sending. */
  schema: Record<string, unknown>;
  callSpark: SparkCaller;
  tracker: UsageTracker;
}

const SPARK_MODEL = "muse-spark-1.3";

/**
 * Inline local `#/$defs/<name>` references and drop `$defs`.
 * Anything else (including `anyOf`) is passed through unchanged.
 * Throws on an unresolvable reference instead of sending a broken schema.
 */
export function inlineSchemaRefs(schema: unknown): unknown {
  const root = schema as Record<string, unknown>;
  const defs = (root?.$defs ?? {}) as Record<string, unknown>;

  const resolve = (node: unknown, seen: Set<string>): unknown => {
    if (Array.isArray(node)) return node.map((n) => resolve(n, seen));
    if (node === null || typeof node !== "object") return node;
    const obj = node as Record<string, unknown>;
    if (typeof obj.$ref === "string") {
      const ref = obj.$ref;
      const match = /^#\/\$defs\/([^/]+)$/.exec(ref);
      if (!match || !(match[1] in defs)) {
        throw new Error(`reason: cannot resolve schema $ref "${ref}"`);
      }
      if (seen.has(ref)) throw new Error(`reason: circular schema $ref "${ref}"`);
      const next = new Set(seen);
      next.add(ref);
      const { $ref: _ignored, ...rest } = obj;
      const resolvedDef = resolve(defs[match[1]], next);
      const resolvedRest = resolve(rest, next);
      // resolve() returns unknown, which cannot be spread directly
      // (TS2698); schema defs are objects, anything else inlines to {}.
      return {
        ...(isRecord(resolvedDef) ? resolvedDef : {}),
        ...(isRecord(resolvedRest) ? resolvedRest : {}),
      };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "$defs") continue;
      out[k] = resolve(v, seen);
    }
    return out;
  };

  return resolve(root, new Set());
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}


/**
 * Prompt 03 rule 7 guard (IMG_9140: a "(total)" row double-counted the
 * zone rows). Drop an inventory row whose label names a total or subtotal
 * when its count equals the sum of the other rows sharing its base label
 * (the label with the trailing parenthetical removed). A total row whose
 * count does not match the zone sum is kept: it may carry real information,
 * and dropping it would lose a count the model actually asserted.
 */
export function dropTotalInventoryRows(inventory: InventoryItem[]): InventoryItem[] {
  const baseLabel = (label: string): string => label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const isTotalRow = (label: string): boolean => /total/i.test(label);
  const sums = new Map<string, number>();
  for (const item of inventory) {
    if (isTotalRow(item.label)) continue;
    const base = baseLabel(item.label);
    sums.set(base, (sums.get(base) ?? 0) + item.count);
  }
  return inventory.filter((item) => {
    if (!isTotalRow(item.label)) return true;
    const sum = sums.get(baseLabel(item.label));
    return sum === undefined || sum !== item.count;
  });
}

/** Confidence filter + rank renumber, with rank references remapped. */
export function filterAndRenumber(output: ReasonOutput): ReasonOutput {
  const kept: Issue[] = [];
  const remap = new Map<number, number>();
  for (const issue of output.issues) {
    const confidence = issue.confidence ?? 0;
    const floor = issue.unmentioned ? 0.6 : 0.5;
    if (confidence < floor) continue;
    remap.set(issue.rank, kept.length + 1);
    kept.push({ ...issue, rank: kept.length + 1 });
  }
  const remapList = (ranks: number[] | undefined): number[] | undefined =>
    ranks === undefined
      ? undefined
      : ranks.filter((r) => remap.has(r)).map((r) => remap.get(r) as number);
  return {
    ...output,
    inventory: dropTotalInventoryRows(output.inventory),
    issues: kept,
    materials: output.materials.map((m) => ({ ...m, forIssues: remapList(m.forIssues) })),
    workOrder: output.workOrder.map((s) => ({ ...s, fixes: remapList(s.fixes) })),
    saidVsSeen: output.saidVsSeen
      .filter((row) => row.issueRank === undefined || remap.has(row.issueRank))
      .map((row) => ({
        ...row,
        issueRank: row.issueRank === undefined ? undefined : remap.get(row.issueRank),
      })),
  };
}

/** Validate a reason result against the input frames and the contract. */
export function validateReason(input: ReasonInput, output: ReasonOutput): string[] {
  const errs: string[] = [];
  output.issues.forEach((issue, i) => {
    const frame = input.frames[issue.frameIndex];
    if (!frame) {
      errs.push(`issues[${i}].frameIndex ${issue.frameIndex} out of range`);
    } else if (issue.frameTimeSec !== frame.tSec) {
      errs.push(
        `issues[${i}].frameTimeSec ${issue.frameTimeSec} does not match frames[${issue.frameIndex}].tSec ${frame.tSec}`,
      );
    }
    issue.proofFrames?.forEach((f, j) => {
      const pf = input.frames[f.frameIndex];
      if (!pf) errs.push(`issues[${i}].proofFrames[${j}].frameIndex out of range`);
      else if (f.tSec !== pf.tSec)
        errs.push(`issues[${i}].proofFrames[${j}].tSec does not match frames[${f.frameIndex}].tSec`);
    });
  });
  if (output.heroFrameIndex < 0 || output.heroFrameIndex >= input.frames.length) {
    errs.push(`heroFrameIndex ${output.heroFrameIndex} out of range`);
  }
  // Contract check on the assembled shell (frames omitted: the full
  // pipeline re-runs checkWorkPlan once frames are attached).
  const shell: WorkPlan = {
    spaceName: output.spaceName,
    generatedFrom: output.generatedFrom,
    inventory: output.inventory,
    issues: output.issues,
    materials: output.materials,
    workOrder: output.workOrder,
    afterImageUrl: null,
    transcript: input.transcript,
    transcriptSummary: output.transcriptSummary,
    saidVsSeen: output.saidVsSeen,
    heroFrameIndex: output.heroFrameIndex,
  };
  return [...errs, ...checkWorkPlan(shell)];
}

function shapeProblems(json: unknown): string[] {
  if (!isRecord(json)) return ["reason: model output is not a JSON object"];
  const errs: string[] = [];
  for (const key of ["spaceName", "generatedFrom", "inventory", "issues", "materials", "workOrder", "transcriptSummary", "saidVsSeen", "heroFrameIndex"]) {
    if (!(key in json)) errs.push(`reason: model output is missing "${key}"`);
  }
  if (!Array.isArray(json.issues)) errs.push('reason: "issues" is not an array');
  return errs;
}

export async function runReason(input: ReasonInput, deps: ReasonDeps): Promise<ReasonOutput> {
  const schema = inlineSchemaRefs(deps.schema) as Record<string, unknown>;
  const images = input.frames.map((f) => f.dataUrl);
  let prompt = deps.prompt;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await deps.callSpark({ model: SPARK_MODEL, prompt, images, schema });
    // The tracker enforces the spike cap: a throw here stops the run.
    deps.tracker.record({ model: SPARK_MODEL, step: "reason", latencyMs: res.latencyMs, costUsd: res.costUsd });

    const shapeErrs = shapeProblems(res.json);
    if (shapeErrs.length > 0) {
      lastErrors = shapeErrs;
    } else {
      const filtered = filterAndRenumber(res.json as ReasonOutput);
      const errs = validateReason(input, filtered);
      if (errs.length === 0) return filtered;
      lastErrors = errs;
    }
    if (attempt === 0) {
      prompt = `${deps.prompt}\n\nThe previous output failed validation. Fix these problems and return the full corrected JSON:\n${lastErrors.map((e) => `- ${e}`).join("\n")}`;
    }
  }
  throw new Error(`reason: validation failed after retry:\n${lastErrors.map((e) => `- ${e}`).join("\n")}`);
}


