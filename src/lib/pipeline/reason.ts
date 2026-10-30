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
 *   appended to the prompt. If neither attempt validates cleanly but
 *   at least one parsed and passed the shape check, return the better
 *   result (fewer validation errors, first wins ties) with those
 *   errors on `warnings` instead of failing the run; throw only when
 *   neither attempt gives a schema-valid result (Grok Bot, 2026-10-27
 *   9:55 AM). The runner logs the warnings server-side.
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

/** SAM segmentation result, per prompt 02. Counts are summed across zones (each zone's best frame), floored at the whole-video single-frame max; with no zones the take is one zone, so the count is the old single-frame max. */
export interface SegmentationResult {
  counts: { label: string; count: number; confidence: number }[];
  /** Sorted, unique frame indices with a hazard-concept instance. */
  flaggedFrames: number[];
}

/** One frame handed to the reason step, in array order. */
export interface ReasonFrame {
  tSec: number;
  /** Browser zone id from PlanRequest.frames (proposal B), printed in the reason frame list when given; omit it and the frame is unzoned. */
  zoneId?: number;
  /** Data URL of the still image, attached to the model call in order. */
  dataUrl: string;
}

export interface ReasonInput {
  frames: ReasonFrame[];
  /**
   * SAM segmentation result, or null when the segment step failed.
   * runPlan logs the failure and continues with null, so the reason
   * step counts from the frames with no SAM floor. runReason never
   * reads this field itself — it rides into the prompt through
   * buildReasonPrompt — so null only changes the prompt text.
   */
  segmentation: SegmentationResult | null;
  /** Transcript string, or null when there is no narration. */
  transcript: string | null;
  spaceName?: string;
  spaceType?: string;
  durationSec: number;
}

/** The part of WorkPlan this step fills. */
export interface ReasonOutput {
  /**
   * Validation errors kept with a returned-but-imperfect result (see
   * runReason). Empty/absent on a clean result. The runner decides
   * whether the full plan can still render with them; they are never
   * sent to the UI as a plan field.
   */
  warnings?: string[];
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
  }): Promise<{
    json: unknown;
    latencyMs: number;
    costUsd: number;
    /** Model the caller actually used; omitted means the requested one. */
    model?: string;
  }>;
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

/** Max decoded bytes per reason frame, same shape as the Spark caller's 5 MB image cap. */
const MAX_REASON_IMAGE_BYTES = 5 * 1024 * 1024;

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

/**
 * Fail fast on a bad reason request, before any paid Spark call.
 * A bad request used to spend up to two Spark calls (initial attempt
 * plus retry) and only fail downstream, when the step parsed an empty
 * or garbage result. Shape-only checks for segmentation: runReason
 * never reads it directly (it rides into the prompt through
 * buildReasonPrompt), so flaggedFrames are checked as integers >= 0
 * but not range-checked against frames here, and counts are checked
 * as whole numbers, since a fractional count is not a count.
 */
/**
 * True when the string is valid base64, by the same rule the route
 * validator uses (src/lib/pipeline/planRequest.ts): base64 alphabet
 * plus up to two padding chars, length a multiple of 4, whitespace
 * ignored. Used only by validateReasonRequest below.
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

export function validateReasonRequest(input: ReasonInput, deps: ReasonDeps): void {
  if (!input || typeof input !== "object") {
    throw new Error("reason: input must be an object");
  }
  if (!Array.isArray(input.frames) || input.frames.length === 0) {
    throw new Error("reason: frames must be a non-empty array");
  }
  input.frames.forEach((f, i) => {
    if (
      !f ||
      typeof f !== "object" ||
      typeof f.tSec !== "number" ||
      !Number.isFinite(f.tSec) ||
      f.tSec < 0 ||
      typeof f.dataUrl !== "string" ||
      f.dataUrl.trim().length === 0
    ) {
      throw new Error(`reason: frame ${i} has no valid tSec/dataUrl`);
    }
    // Parity with the route validator (src/lib/pipeline/planRequest.ts)
    // and validateRunPlanRequest: a frame dataUrl must be a
    // data:image base64 URL carrying a real image header. A bare
    // string (or a text blob re-labelled data:image/jpeg) used to
    // pass here and only surface later, when the paid reason call
    // was spent on garbage input. A direct runReason caller gets the
    // same fail-fast here instead of only via the route.
    if (
      !f.dataUrl.startsWith("data:image/") ||
      !f.dataUrl.includes(";base64,")
    ) {
      throw new Error(
        `reason: frame ${i} dataUrl must be a data:image base64 URL`,
      );
    }
    {
      const payload = f.dataUrl.slice(f.dataUrl.indexOf(";base64,") + 8);
      if (payload.length === 0 || !isBase64(payload)) {
        throw new Error(
          `reason: frame ${i} dataUrl must carry valid base64 image data`,
        );
      }
      if (!isImageBase64(payload)) {
        throw new Error(
          `reason: frame ${i} dataUrl must carry image data (JPEG, PNG, WebP, or GIF)`,
        );
      }
      // Same shape as the Spark caller's 5 MB image cap: the reason
      // frames are 1024 px JPEGs, but a direct runReason caller
      // bypassing runPlan had no bound here, so an unbounded frame
      // would ride onto a paid Spark call before any cap could stop
      // it. 5 MB decoded is wide headroom over a 1024 px JPEG frame;
      // reject it here, before any fetch.
      const stripped = payload.replace(/\s/g, "");
      const padding = stripped.endsWith("==") ? 2 : stripped.endsWith("=") ? 1 : 0;
      const decodedBytes = (stripped.length * 3) / 4 - padding;
      if (decodedBytes > MAX_REASON_IMAGE_BYTES) {
        throw new Error(
          `reason: frame ${i} dataUrl must be at most 5 MB, got ${decodedBytes} bytes`,
        );
      }
    }
  });
  if (input.segmentation !== null) {
    const seg = input.segmentation;
    if (!seg || typeof seg !== "object") {
      throw new Error("reason: segmentation must be an object or null");
    }
    if (!Array.isArray(seg.counts)) {
      throw new Error("reason: segmentation.counts must be an array");
    }
    seg.counts.forEach((c, i) => {
      // Counts are whole instances (the segment step takes a max over
      // frames): a fractional count used to pass this check and ride
      // into the reason prompt as nonsense like "2.5 chairs".
      if (
        !c ||
        typeof c !== "object" ||
        typeof c.label !== "string" ||
        c.label.trim().length === 0 ||
        typeof c.count !== "number" ||
        !Number.isInteger(c.count) ||
        c.count < 0 ||
        typeof c.confidence !== "number" ||
        !Number.isFinite(c.confidence) ||
        c.confidence < 0 ||
        c.confidence > 1
      ) {
        throw new Error(`reason: segmentation.counts[${i}] has no valid label/count/confidence`);
      }
    });
    if (
      !Array.isArray(seg.flaggedFrames) ||
      seg.flaggedFrames.some((f) => !Number.isInteger(f) || f < 0)
    ) {
      throw new Error("reason: segmentation.flaggedFrames must be an array of integers >= 0");
    }
  }
  if (input.transcript !== null && typeof input.transcript !== "string") {
    throw new Error("reason: transcript must be a string or null");
  }
  for (const field of ["spaceName", "spaceType"] as const) {
    const v = input[field];
    if (v !== undefined && (typeof v !== "string" || v.trim().length === 0)) {
      throw new Error(`reason: ${field} must be a non-empty string when given`);
    }
  }
  if (typeof input.durationSec !== "number" || !Number.isFinite(input.durationSec) || input.durationSec < 0) {
    throw new Error(`reason: durationSec must be a finite number >= 0, got ${input.durationSec}`);
  }
  if (!deps || typeof deps !== "object") {
    throw new Error("reason: deps must be an object");
  }
  if (typeof deps.prompt !== "string" || deps.prompt.trim().length === 0) {
    throw new Error("reason: prompt must be a non-empty string");
  }
  if (!isRecord(deps.schema)) {
    throw new Error("reason: schema must be an object");
  }
  if (typeof deps.callSpark !== "function") {
    throw new Error("reason: callSpark must be a function");
  }
  if (!deps.tracker || typeof deps.tracker.record !== "function") {
    throw new Error("reason: tracker.record must be a function");
  }
}

export async function runReason(input: ReasonInput, deps: ReasonDeps): Promise<ReasonOutput> {
  validateReasonRequest(input, deps);
  const schema = inlineSchemaRefs(deps.schema) as Record<string, unknown>;
  const images = input.frames.map((f) => f.dataUrl);
  let prompt = deps.prompt;
  let lastErrors: string[] = [];
  // Best schema-valid candidate so far: the filtered output plus its
  // remaining validation errors. Shape failures never become a
  // candidate, so a returned result always parsed and passed the
  // shape check, per the Grok Bot 2026-10-27 9:55 AM guard.
  let best: { output: ReasonOutput; errs: string[] } | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await deps.callSpark({ model: SPARK_MODEL, prompt, images, schema });
    // The tracker enforces the spike cap: a throw here stops the run.
    // Record the model the caller actually used: the Baseten adapter
    // reports its configured model, so the route's done log line names
    // it instead of muse-spark-1.3 in baseten mode (Grok Bot,
    // 2026-10-27 12:05 PM). The Meta path omits it and keeps the
    // requested model.
    deps.tracker.record({ model: res.model ?? SPARK_MODEL, step: "reason", latencyMs: res.latencyMs, costUsd: res.costUsd });

    const shapeErrs = shapeProblems(res.json);
    if (shapeErrs.length > 0) {
      lastErrors = shapeErrs;
    } else {
      const filtered = filterAndRenumber(res.json as ReasonOutput);
      const errs = validateReason(input, filtered);
      if (errs.length === 0) return filtered;
      lastErrors = errs;
      if (best === null || errs.length < best.errs.length) {
        best = { output: filtered, errs };
      }
    }
    if (attempt === 0) {
      prompt = `${deps.prompt}\n\nThe previous output failed validation. Fix these problems and return the full corrected JSON:\n${lastErrors.map((e) => `- ${e}`).join("\n")}`;
    }
  }
  if (best !== null) return { ...best.output, warnings: best.errs };
  throw new Error(`reason: no schema-valid result after retry:\n${lastErrors.map((e) => `- ${e}`).join("\n")}`);
}


