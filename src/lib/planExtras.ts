/**
 * Optional plan fields for richer findings (items 2, 6 and 7 of the Oct 30 plan), read defensively.
 *
 * The fields are declared (optional) in types.ts: Issue.tier/area/evidence/checklistKey/watch, WorkPlan.watch
 * and WorkPlan.coverageNote. Everything here still reads them defensively from an untrusted plan and falls
 * back to what older plans carry, so the plan screen renders the same whether or not the server sends them.
 * Pure, no DOM.
 */
import type { Box, FrameRef, Issue, IssueTier, Severity, WatchIssue, WorkPlan } from "./types";

/** How soon to act. Maps from severity when the server doesn't send one. */
export type Tier = IssueTier;

export const TIERS: readonly Tier[] = ["urgent", "soon", "later"];

export const TIER_LABEL: Record<Tier, string> = { urgent: "Fix now", soon: "Fix soon", later: "Can wait" };
export const TIER_HINT: Record<Tier, string> = {
  urgent: "Safety problems to deal with before the space is used again.",
  soon: "Damage that will get worse, or things that don't work.",
  later: "Cosmetic. Plan these in when there's time.",
};

const SEVERITY_TIER: Record<Severity, Tier> = { high: "urgent", medium: "soon", low: "later" };

const isTier = (v: unknown): v is Tier => v === "urgent" || v === "soon" || v === "later";
const str = (v: unknown, max = 200): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? (t.length > max ? `${t.slice(0, max - 1)}…` : t) : undefined;
};
const num01 = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : undefined);

/** The issue's tier: its own when valid, else from severity. */
export function issueTier(issue: Pick<Issue, "severity"> & { tier?: unknown }): Tier {
  return isTier(issue.tier) ? issue.tier : (SEVERITY_TIER[issue.severity] ?? "soon");
}

/** Optional per-issue detail: where it is and what the photo literally shows. */
export function issueExtras(issue: Issue): { area?: string; evidence?: string } {
  const o = issue as unknown as Record<string, unknown>;
  return { area: str(o.area, 80), evidence: str(o.evidence, 160) };
}

/** Problems grouped by tier, tiers in order, ranks kept in order inside each; empty tiers left out. */
export function groupByTier(issues: Issue[]): { tier: Tier; issues: Issue[] }[] {
  return TIERS.map((tier) => ({ tier, issues: issues.filter((i) => issueTier(i) === tier) })).filter((g) => g.issues.length > 0);
}

/** One lower-confidence finding for "Worth a closer look" (the declared WorkPlan.watch shape). */
export type WatchItem = WatchIssue;

function parseBox(v: unknown): Box | undefined {
  if (!Array.isArray(v) || v.length !== 4 || !v.every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;
  const [x1, y1, x2, y2] = v.map((n) => Math.max(0, Math.min(1000, n))) as Box;
  return x2 > x1 && y2 > y1 ? [x1, y1, x2, y2] : undefined;
}

function parseFrameRefs(v: unknown, nFrames: number): FrameRef[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: FrameRef[] = [];
  for (const r of v) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.frameIndex !== "number" || !Number.isInteger(o.frameIndex) || o.frameIndex < 0 || o.frameIndex >= nFrames) continue;
    const ref: FrameRef = { frameIndex: o.frameIndex, tSec: typeof o.tSec === "number" ? o.tSec : 0 };
    const box = parseBox(o.box);
    if (box) ref.box = box;
    const caption = str(o.caption, 120);
    if (caption) ref.caption = caption;
    if (o.boxSource === "sam" || o.boxSource === "model") (ref as FrameRef & { boxSource?: string }).boxSource = o.boxSource;
    out.push(ref);
  }
  return out.length ? out : undefined;
}

/**
 * "Worth a closer look": plan.watch, plus any issue flagged watch: true (in case the server marks them in
 * place). Items that don't point at a real frame are dropped; at most 12.
 */
export function watchItems(plan: Pick<WorkPlan, "issues" | "frames">): WatchItem[] {
  const nFrames = plan.frames?.length ?? 0;
  const raw = (plan as unknown as { watch?: unknown }).watch;
  const list: unknown[] = [...(Array.isArray(raw) ? raw : []), ...plan.issues.filter((i) => (i as unknown as { watch?: unknown }).watch === true)];
  const out: WatchItem[] = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const title = str(o.title, 120);
    if (!title || typeof o.frameIndex !== "number" || !Number.isInteger(o.frameIndex) || o.frameIndex < 0 || (nFrames && o.frameIndex >= nFrames)) continue;
    out.push({
      title,
      detail: str(o.detail, 400) ?? "",
      confidence: num01(o.confidence),
      frameIndex: o.frameIndex,
      frameTimeSec: typeof o.frameTimeSec === "number" ? o.frameTimeSec : (plan.frames?.[o.frameIndex]?.tSec ?? 0),
      area: str(o.area, 80),
      evidence: str(o.evidence, 160),
      checklistKey: str(o.checklistKey, 40),
      proofFrames: parseFrameRefs(o.proofFrames, nFrames || Number.MAX_SAFE_INTEGER),
    });
    if (out.length >= 12) break;
  }
  return out;
}

/** The ranked problems, without any marked watch: true (those show under "Worth a closer look"). */
export function rankedIssues(plan: Pick<WorkPlan, "issues">): Issue[] {
  return plan.issues.filter((i) => (i as unknown as { watch?: unknown }).watch !== true);
}

/** Why the plan has few problems, when the server says. */
export function coverageNote(plan: WorkPlan): string | undefined {
  return str((plan as unknown as { coverageNote?: unknown }).coverageNote, 240);
}

/** Where a proof box came from. "sam" draws solid even when the plan's outline step is otherwise off. */
export function boxSource(ref: FrameRef | undefined): "sam" | "model" | undefined {
  const s = (ref as (FrameRef & { boxSource?: unknown }) | undefined)?.boxSource;
  return s === "sam" || s === "model" ? s : undefined;
}
