import type { Issue, WorkPlan } from "@/lib/types";
import type { RecentEntry } from "./recentPlans";
import { planLocation } from "./planText";

/**
 * "Since your last walkthrough": compares a finished plan with the previous saved plan of the same
 * space and place on this device, so a crew lead who films again after a work day sees what is no
 * longer seen, what is still there and what is new. Pure and browser-free; no model calls.
 *
 * Problems are matched by what they are (checklist key, hazard or category), where they are (area
 * words) and what they're called (title words). It is a best guess, so the screen says so.
 */
export type CompareRow = { title: string; tier: "urgent" | "soon" | "later" };
export type PlanComparison = {
  stillThere: CompareRow[];
  newOnes: CompareRow[];
  gone: CompareRow[];
};

const STOP = new Set([
  "a", "an", "the", "of", "on", "in", "at", "to", "and", "or", "for", "with", "near", "by", "from", "is", "are",
  "left", "right", "front", "back", "side", "area", "room",
]);

function words(text: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const raw of (text ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    // Plain plural fold, so "cables" matches "cable".
    out.add(raw.length > 4 && raw.endsWith("s") && !raw.endsWith("ss") ? raw.slice(0, -1) : raw);
  }
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

function kind(i: Issue): string | null {
  return i.checklistKey || i.hazard || null;
}

export function issueTier(i: Issue): CompareRow["tier"] {
  if (i.tier === "urgent" || i.tier === "soon" || i.tier === "later") return i.tier;
  return i.severity === "high" ? "urgent" : i.severity === "medium" ? "soon" : "later";
}

/** 0 to 1: how likely two problems are the same thing. Under MATCH_AT counts as different. */
export function matchScore(a: Issue, b: Issue): number {
  const ka = kind(a);
  const kb = kind(b);
  if (ka && kb && ka !== kb) return 0;
  const title = overlap(words(a.title), words(b.title));
  const area = a.area && b.area ? overlap(words(a.area), words(b.area)) : null;
  let s = title * 0.6 + (area === null ? 0.15 : area * 0.25);
  if (ka && kb && ka === kb) s += 0.35;
  else if (a.category && b.category && a.category === b.category) s += 0.1;
  return Math.min(1, s);
}
export const MATCH_AT = 0.45;

/** Ranked problems only: "Worth a closer look" items and said-but-not-seen rows aren't compared. */
function comparable(plan: WorkPlan): Issue[] {
  return (plan.issues ?? []).filter((i) => !i.watch && i.status !== "mentioned_not_seen");
}

const row = (i: Issue): CompareRow => ({ title: i.title, tier: issueTier(i) });

export function comparePlans(current: WorkPlan, previous: WorkPlan): PlanComparison {
  const now = comparable(current);
  const before = comparable(previous);
  const pairs: { n: number; b: number; s: number }[] = [];
  now.forEach((x, n) => before.forEach((y, b) => {
    const s = matchScore(x, y);
    if (s >= MATCH_AT) pairs.push({ n, b, s });
  }));
  // Best pairs first, each problem used once.
  pairs.sort((p, q) => q.s - p.s || p.n - q.n || p.b - q.b);
  const usedN = new Set<number>();
  const usedB = new Set<number>();
  for (const p of pairs) {
    if (usedN.has(p.n) || usedB.has(p.b)) continue;
    usedN.add(p.n);
    usedB.add(p.b);
  }
  return {
    stillThere: now.filter((_, n) => usedN.has(n)).map(row),
    newOnes: now.filter((_, n) => !usedN.has(n)).map(row),
    gone: before.filter((_, b) => !usedB.has(b)).map(row),
  };
}

const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The saved run to compare with: the newest saved plan of the same space name and the same city and
 * state, other than this one and saved before it. Null when there is none.
 */
export function previousEntry(plan: WorkPlan, list: readonly RecentEntry[], currentId: string): RecentEntry | null {
  const space = norm(plan.spaceName) || "walkthrough";
  const region = norm(planLocation(plan));
  const self = list.find((e) => e.id === currentId);
  const selfTime = self ? Date.parse(self.savedAt) : Number.POSITIVE_INFINITY;
  for (const e of list) {
    if (e.id === currentId) continue;
    if (norm(e.spaceName) !== space || norm(e.region) !== region) continue;
    const t = Date.parse(e.savedAt);
    if (Number.isNaN(t) || t >= selfTime) continue;
    return e;
  }
  return null;
}

/** One-line summary for the card heading, e.g. "2 no longer seen, 1 still there, 1 new". */
export function compareSummary(c: PlanComparison): string {
  const parts: string[] = [];
  if (c.gone.length) parts.push(`${c.gone.length} no longer seen`);
  if (c.stillThere.length) parts.push(`${c.stillThere.length} still there`);
  if (c.newOnes.length) parts.push(`${c.newOnes.length} new`);
  return parts.length ? parts.join(", ") : "No problems in either walkthrough";
}

const SHARE_TIER: Record<CompareRow["tier"], string> = { urgent: "fix now", soon: "fix soon", later: "can wait" };
/** Titles listed per group in the shared text before "and N more". */
export const MAX_SHARE_COMPARE = 3;

function shareGroup(label: string, rows: CompareRow[]): string | null {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, MAX_SHARE_COMPARE).map((r) => `${r.title.replace(/\s+/g, " ").trim()} (${SHARE_TIER[r.tier]})`);
  const more = rows.length > MAX_SHARE_COMPARE ? `; and ${rows.length - MAX_SHARE_COMPARE} more` : "";
  return `- ${label}: ${shown.join("; ")}${more}`;
}

/**
 * The comparison as plain-text lines for "Send to your team": a heading with the summary and the earlier
 * date, one line per group (a few titles each), and the same "check the photos" caution as the screen.
 * Empty when neither walkthrough has a ranked problem, so the text doesn't grow a section that says nothing.
 */
export function compareShareLines(c: PlanComparison, when?: string | null): string[] {
  if (c.gone.length + c.stillThere.length + c.newOnes.length === 0) return [];
  const lines = [`Since the last walkthrough${when ? ` (${when})` : ""}: ${compareSummary(c)}.`];
  for (const g of [
    shareGroup("No longer seen", c.gone),
    shareGroup("Still there", c.stillThere),
    shareGroup("New this time", c.newOnes),
  ]) {
    if (g) lines.push(g);
  }
  lines.push("Matched by what and where, so check the photos before counting one as fixed.");
  return lines;
}
