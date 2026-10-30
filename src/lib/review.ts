/**
 * Reviewer pass helpers shared by the plan screen, the share text and the examples.
 * Pure: no imports beyond the plan types, so the pipeline can use them too.
 *
 * The reviewer is review-only. Nothing here edits a plan's text; it reads `plan.review`,
 * checks its shape, and turns it into the badge and summary line the plan shows.
 */
import type { Issue, PlanReview, PlanReviewItem, WorkPlan } from "./types";

/** Re-exported so pipeline code can import the review types from here or from ./types. */
export type { PlanReview, PlanReviewItem } from "./types";

/** Longest reason the plan shows; longer ones are cut at a word. */
export const MAX_REASON_CHARS = 140;

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max / 2 ? cut.slice(0, sp) : cut).replace(/[\s,.;:]+$/, "")}…`;
};

/** The id a reviewer verdict uses for a problem. */
export const problemId = (issue: Pick<Issue, "rank">): string => String(issue.rank);

/**
 * Checks an untrusted review (from the stream or a saved plan) against the plan's problems.
 * Unknown ids are dropped, the first verdict per id wins, reasons are trimmed. Returns undefined
 * for anything that isn't a review at all, so a bad field never breaks the plan screen.
 */
export function parseReview(v: unknown, issues: Pick<Issue, "rank">[]): PlanReview | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.ran !== "boolean") return undefined;
  const ids = new Set(issues.map(problemId));
  const seen = new Set<string>();
  const items: PlanReviewItem[] = [];
  for (const raw of Array.isArray(o.items) ? o.items : []) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    const id = typeof it.problemId === "number" ? String(it.problemId) : it.problemId;
    if (typeof id !== "string" || !ids.has(id) || seen.has(id) || typeof it.verified !== "boolean") continue;
    seen.add(id);
    const reason = typeof it.reason === "string" ? clip(it.reason, MAX_REASON_CHARS) : "";
    items.push({ problemId: id, verified: it.verified, reason });
  }
  const review: PlanReview = { ran: o.ran, items: o.ran ? items : [] };
  if (typeof o.summary === "string" && o.summary.trim()) review.summary = clip(o.summary, 200);
  if (o.source === "model" || o.source === "precomputed") review.source = o.source;
  return review;
}

/** The plan's review, checked; undefined when the plan has none. */
export function planReview(plan: Pick<WorkPlan, "review" | "issues">): PlanReview | undefined {
  return plan.review === undefined ? undefined : parseReview(plan.review, plan.issues);
}

/** This problem's verdict, when the review ran and answered for it. */
export function verdictFor(review: PlanReview | undefined, issue: Pick<Issue, "rank">): PlanReviewItem | undefined {
  if (!review?.ran) return undefined;
  return review.items.find((i) => i.problemId === problemId(issue));
}

/** How many reviewed problems are backed by a photo, out of the problems the reviewer answered for. */
export function reviewTally(review: PlanReview | undefined): { verified: number; total: number } | null {
  if (!review?.ran || review.items.length === 0) return null;
  return { verified: review.items.filter((i) => i.verified).length, total: review.items.length };
}

/**
 * The one line the plan shows about the review, or null when the plan has no review (older plans).
 * Precomputed reviews say so, since no model looked at those photos.
 */
export function reviewLine(review: PlanReview | undefined): string | null {
  if (!review) return null;
  if (!review.ran) return "Review didn't run. Check each problem against its photo before you act on it.";
  const t = reviewTally(review);
  if (!t) return null;
  const n = `${t.verified} of ${t.total} problem${t.total === 1 ? "" : "s"} backed by a photo`;
  return review.source === "precomputed"
    ? `Proof check for this example: ${n}. Worked out ahead of time from the plan's own photos; no model ran.`
    : `Reviewed by a separate check: ${n}.`;
}

const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * A review for a plan that never went through the reviewer (the examples). It records only what the
 * plan itself holds: a problem counts as backed by a photo when it points at a real proof frame and isn't
 * marked "said but not seen". It never judges what the photo shows, and says so (source "precomputed").
 */
export function precomputeReview(plan: Pick<WorkPlan, "issues" | "frames">): PlanReview {
  const frames = plan.frames ?? [];
  const items = plan.issues.map((issue): PlanReviewItem => {
    const proof = issue.proofFrames?.find((p) => frames[p.frameIndex]?.url) ?? (frames[issue.frameIndex]?.url ? { frameIndex: issue.frameIndex, tSec: issue.frameTimeSec } : undefined);
    if (issue.status === "mentioned_not_seen" || !proof) {
      return { problemId: problemId(issue), verified: false, reason: "No proof photo for this one. It came from what was said, so check it in person." };
    }
    const at = mmss(frames[proof.frameIndex]?.tSec ?? proof.tSec);
    const caption = "caption" in proof && proof.caption ? `: ${proof.caption}` : "";
    return { problemId: problemId(issue), verified: true, reason: clip(`Proof photo at ${at}${caption}`, MAX_REASON_CHARS) };
  });
  return { ran: true, items, source: "precomputed" };
}

/** The plan with a precomputed review added, unless it already has one. */
export function withPrecomputedReview<T extends WorkPlan>(plan: T): T {
  return plan.review ? plan : { ...plan, review: precomputeReview(plan) };
}
