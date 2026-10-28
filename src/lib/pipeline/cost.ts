/**
 * SightWork pipeline step: `estimateCost`.
 *
 * Turns the `reason` output (materials + work steps) into a rough,
 * region-grounded cost range (prompt 05 in the planning repo: prompt,
 * schema, and math rule). This file implements the call, the math,
 * and the validation.
 *
 * This module makes no API calls and holds no keys. The model caller is
 * injected by the wiring code (later: src/lib/meta), so the step is
 * testable on mock data and the spike can swap callers without touching
 * this logic. Every call is recorded on the usage tracker from ./usage.ts,
 * so the $10 spike cap is enforced in code (the tracker throws).
 *
 * Rules enforced here, in code, not trusted to the model (prompt 05):
 * - Skip rule: no region (missing or blank) means NO model call and a
 *   null result, so costRange stays null. A region is never assumed.
 * - The model returns unit prices, a labor rate, contingency, assumptions
 *   and sources; code computes the range. Totals are reproducible.
 * - Materials: qty is the leading number of the qty string, or 1 when
 *   there is none. A material with no model price gets [0, 0] plus a
 *   "No price for <item>" assumption line. A model price for a
 *   material index outside the materials array is ignored, never
 *   silently dropped: it adds an "Ignored price for material index
 *   <n>" assumption line, so a model slip stays visible on the plan
 *   instead of surfacing as a puzzling "No price" line. A second
 *   price for the same material index is likewise surfaced: it adds
 *   a "Duplicate price for material index <n>" assumption line (the
 *   last price wins), so a model slip stays visible instead of
 *   silently overwriting the first price.
 * - Labor: volunteer basis pays only licensed trades (electrician,
 *   plumber, roofer); contractor pays every step; mixed pays every step
 *   whose trade is not "volunteer". Steps without hours add no labor.
 * - Contingency is clamped to 10-20% and inverted pairs are swapped.
 * - Sources keep only http(s) URLs; the field is omitted when none are
 *   left. (The caller passes only web_search results; code cannot
 *   verify provenance beyond the URL shape.)
 * - The result is validated with checkWorkPlan from ../types.
 * - The usage tracker records cost/latency per call; it has no
 *   per-call search-count field, so web_search cost is folded into the
 *   caller's costUsd (see the meta client, later).
 */

import {
  COST_LABEL,
  checkWorkPlan,
  type CostRange,
  type InventoryItem,
  type Issue,
  type LaborBasis,
  type MaterialItem,
  type WorkPlan,
  type WorkStep,
} from "../types";
import type { UsageTracker } from "./usage";

/** Reason output this step consumes, plus the cost request fields. */
export interface CostInput {
  spaceName: string;
  generatedFrom: string;
  inventory: InventoryItem[];
  issues: Issue[];
  materials: MaterialItem[];
  workOrder: WorkStep[];
  /** Region for prices and labor, e.g. "Sebring, FL". Omit it and the result is null. */
  region?: string;
  laborBasis?: LaborBasis;
}

/** A model call supplied by the wiring code. Never a real call in tests. */
export interface CostCaller {
  (req: {
    model: string;
    prompt: string;
    schema: Record<string, unknown>;
  }): Promise<{ json: unknown; latencyMs: number; costUsd: number }>;
}

export interface CostDeps {
  /** Prompt text (prompt 05), with placeholders already filled. */
  prompt: string;
  /** Structured-output schema (prompt 05). Flat: no $ref, no anyOf. */
  schema: Record<string, unknown>;
  callSpark: CostCaller;
  tracker: UsageTracker;
}

/** What the step returns: the range plus materials with unitCost filled in. */
export interface CostResult {
  costRange: CostRange;
  materials: MaterialItem[];
}

/** One model-supplied unit price, keyed by material index. */
export interface ModelUnitCost {
  materialIndex: number;
  unit: string;
  unitCost: [low: number, high: number];
  grounded: boolean;
  sourceIndex?: number;
}

/** The model output for prompt 05, after shape validation. */
export interface CostModelOutput {
  unitCosts: ModelUnitCost[];
  laborRate: [low: number, high: number];
  contingencyPct: [low: number, high: number];
  assumptions: string[];
  sources: { title: string; url: string }[];
}

const SPARK_MODEL = "muse-spark-1.3";
const LICENSED_TRADE = /electrician|plumber|roofer/i;
const COMPUTED_LINE =
  "Total = materials + labor + contingency, computed from the line items";

/** Leading number of a qty string ("12 chairs" -> 12, "1 box" -> 1, none -> 1). */
export function parseQty(qty: string): number {
  const m = /^\s*(\d+(?:\.\d+)?)/.exec(qty);
  return m ? Number(m[1]) : 1;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isPair(v: unknown): v is [number, number] {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)
  );
}

/** Swap an inverted pair so low <= high. Throws on a non-pair. */
function normalizePair(pair: unknown, what: string): [number, number] {
  if (!isPair(pair)) throw new Error(`estimateCost: ${what} must be [low, high] numbers >= 0`);
  const [lo, hi] = pair;
  return hi < lo ? [hi, lo] : [lo, hi];
}

/** Validate the model JSON shape; throw instead of guessing. */
export function parseCostModel(json: unknown): CostModelOutput {
  if (!isRecord(json)) throw new Error("estimateCost: model output is not a JSON object");
  if (!Array.isArray(json.unitCosts)) throw new Error('estimateCost: "unitCosts" is not an array');
  const unitCosts: ModelUnitCost[] = json.unitCosts.map((u, i) => {
    if (!isRecord(u)) throw new Error(`estimateCost: unitCosts[${i}] is not an object`);
    if (!Number.isInteger(u.materialIndex) || (u.materialIndex as number) < 0)
      throw new Error(`estimateCost: unitCosts[${i}].materialIndex must be an integer >= 0`);
    if (typeof u.unit !== "string") throw new Error(`estimateCost: unitCosts[${i}].unit must be a string`);
    if (typeof u.grounded !== "boolean")
      throw new Error(`estimateCost: unitCosts[${i}].grounded must be a boolean`);
    return {
      materialIndex: u.materialIndex as number,
      unit: u.unit,
      unitCost: normalizePair(u.unitCost, `unitCosts[${i}].unitCost`),
      grounded: u.grounded,
      sourceIndex:
        Number.isInteger(u.sourceIndex) && (u.sourceIndex as number) >= 0
          ? (u.sourceIndex as number)
          : undefined,
    };
  });
  if (!Array.isArray(json.assumptions) || !json.assumptions.every((a) => typeof a === "string"))
    throw new Error('estimateCost: "assumptions" must be an array of strings');
  if (!Array.isArray(json.sources)) throw new Error('estimateCost: "sources" is not an array');
  const sources = json.sources
    .filter(
      (s): s is { title: string; url: string } =>
        isRecord(s) && typeof s.title === "string" && typeof s.url === "string" && /^https?:\/\//.test(s.url),
    )
    .map((s) => ({ title: s.title, url: s.url }));
  return {
    unitCosts,
    laborRate: normalizePair(json.laborRate, "laborRate"),
    contingencyPct: normalizePair(json.contingencyPct, "contingencyPct"),
    assumptions: json.assumptions as string[],
    sources,
  };
}

/** True when this step's labor is paid under the given basis. */
function laborPaid(trade: string | undefined, basis: LaborBasis): boolean {
  const t = (trade ?? "").trim().toLowerCase();
  if (basis === "contractor") return true;
  if (basis === "mixed") return t !== "volunteer";
  return LICENSED_TRADE.test(t);
}

function round10(n: number): number {
  return Math.round(n / 10) * 10;
}

/**
 * Pure math from prompt 05: unit prices + labor + contingency -> CostRange,
 * with each material's unitCost filled in. No model call, no tracker.
 */
export function computeCostRange(
  materials: MaterialItem[],
  workOrder: WorkStep[],
  region: string,
  laborBasis: LaborBasis,
  model: CostModelOutput,
): CostResult {
  const byIndex = new Map<number, ModelUnitCost>();
  const ignored = new Set<number>();
  const duplicates = new Set<number>();
  for (const u of model.unitCosts) {
    // parseCostModel only checks materialIndex >= 0, so an index past
    // the end of the materials array would otherwise vanish here with
    // no trace: the material it meant keeps a "No price" line and the
    // stray price is never seen. Keep it visible instead. Likewise a
    // second price for an index already seen would silently overwrite
    // the first; keep that visible too, with the last price winning.
    if (u.materialIndex < materials.length) {
      if (byIndex.has(u.materialIndex)) duplicates.add(u.materialIndex);
      byIndex.set(u.materialIndex, u);
    } else ignored.add(u.materialIndex);
  }

  const missing: string[] = [];
  const filled: MaterialItem[] = materials.map((m, i) => {
    const u = byIndex.get(i);
    if (!u) {
      missing.push(`No price for ${m.item}`);
      return { ...m, unitCost: [0, 0] as [number, number] };
    }
    return { ...m, unitCost: u.unitCost };
  });

  let materialsLow = 0;
  let materialsHigh = 0;
  for (const m of filled) {
    const q = parseQty(m.qty);
    const [lo, hi] = m.unitCost ?? [0, 0];
    materialsLow += q * lo;
    materialsHigh += q * hi;
  }

  let laborLow = 0;
  let laborHigh = 0;
  for (const step of workOrder) {
    if (!step.hours || !laborPaid(step.trade, laborBasis)) continue;
    const [hLo, hHi] = step.hours[0] <= step.hours[1] ? step.hours : [step.hours[1], step.hours[0]];
    laborLow += hLo * model.laborRate[0];
    laborHigh += hHi * model.laborRate[1];
  }

  const [cLo, cHi] = model.contingencyPct;
  const contLo = Math.min(20, Math.max(10, cLo));
  const contHi = Math.min(20, Math.max(10, cHi));
  const subtotalLow = materialsLow + laborLow;
  const subtotalHigh = materialsHigh + laborHigh;
  const low = round10(subtotalLow * (1 + contLo / 100));
  const high = round10(subtotalHigh * (1 + contHi / 100));

  const costRange: CostRange = {
    low,
    high,
    currency: "USD",
    label: COST_LABEL,
    region,
    laborBasis,
    assumptions: [
      ...model.assumptions,
      COMPUTED_LINE,
      ...missing,
      ...[...ignored].sort((a, b) => a - b).map((n) => `Ignored price for material index ${n} (no such material)`),
      ...[...duplicates].sort((a, b) => a - b).map((n) => `Duplicate price for material index ${n} (kept the last price)`),
    ],
    ...(model.sources.length > 0 ? { sources: model.sources } : {}),
  };
  return { costRange, materials: filled };
}

/**
 * Fail fast on a bad request before any paid Spark call: a non-object
 * input or a non-array materials/workOrder used to throw a bare
 * TypeError deep inside computeCostRange, after the model call.
 */
export function validateCostInput(input: CostInput): void {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("estimateCost: input is not an object");
  }
  for (const field of ["spaceName", "generatedFrom"] as const) {
    const v = input[field];
    if (typeof v !== "string" || v.trim().length === 0) {
      throw new Error(`estimateCost: ${field} must be a non-empty string`);
    }
  }
  for (const field of ["inventory", "issues", "materials", "workOrder"] as const) {
    if (!Array.isArray(input[field])) {
      throw new Error(`estimateCost: ${field} is not an array`);
    }
  }
  if (input.region !== undefined && typeof input.region !== "string") {
    throw new Error("estimateCost: region must be a string when given");
  }
  if (
    input.laborBasis !== undefined &&
    input.laborBasis !== "volunteer" &&
    input.laborBasis !== "contractor" &&
    input.laborBasis !== "mixed"
  ) {
    throw new Error(`estimateCost: laborBasis must be volunteer, contractor or mixed, got ${input.laborBasis}`);
  }
}

/**
 * Fail fast on bad wiring after the no-region skip but before the paid
 * Spark call: a tracker without record used to throw only after the
 * call, when record ran, so the spend was already made.
 */
export function validateCostDeps(deps: CostDeps): void {
  if (deps === null || typeof deps !== "object" || Array.isArray(deps)) {
    throw new Error("estimateCost: deps is not an object");
  }
  if (typeof deps.prompt !== "string" || deps.prompt.trim().length === 0) {
    throw new Error("estimateCost: prompt must be a non-empty string");
  }
  if (!isRecord(deps.schema)) {
    throw new Error("estimateCost: schema must be an object");
  }
  if (typeof deps.callSpark !== "function") {
    throw new Error("estimateCost: callSpark must be a function");
  }
  if (
    deps.tracker === null ||
    typeof deps.tracker !== "object" ||
    typeof deps.tracker.record !== "function"
  ) {
    throw new Error("estimateCost: tracker.record is not a function");
  }
}

/**
 * Run the cost step. Returns null without calling the model when no
 * region was supplied. Otherwise one model call, tracker-recorded, then
 * the math above and a checkWorkPlan validation of the result.
 */
export async function estimateCost(input: CostInput, deps: CostDeps): Promise<CostResult | null> {
  validateCostInput(input);
  const region = input.region?.trim();
  if (!region) return null;
  validateCostDeps(deps);
  const laborBasis = input.laborBasis ?? "volunteer";

  const res = await deps.callSpark({ model: SPARK_MODEL, prompt: deps.prompt, schema: deps.schema });
  // The tracker enforces the spike cap: a throw here stops the run.
  deps.tracker.record({
    model: SPARK_MODEL,
    step: "estimateCost",
    latencyMs: res.latencyMs,
    costUsd: res.costUsd,
  });

  const model = parseCostModel(res.json);
  const result = computeCostRange(input.materials, input.workOrder, region, laborBasis, model);

  const shell: WorkPlan = {
    spaceName: input.spaceName,
    generatedFrom: input.generatedFrom,
    inventory: input.inventory,
    issues: input.issues,
    materials: result.materials,
    workOrder: input.workOrder,
    afterImageUrl: null,
    transcript: null,
    costRange: result.costRange,
  };
  const errs = checkWorkPlan(shell);
  if (errs.length > 0) {
    throw new Error(`estimateCost: result failed contract check:\n${errs.map((e) => `- ${e}`).join("\n")}`);
  }
  return result;
}

