import type { RecentEntry } from "@/lib/client/recentPlans";
import type { TakeEntry } from "@/lib/client/savedTakes";

/**
 * Links a saved take to the plan already made from it, so the saved takes list can say "Plan made"
 * and open that plan instead of running (and paying for) the same video twice by accident.
 *
 * A plan matches when the recent plans list has the take's exact file name and the plan was saved
 * at or after the take was kept (an older plan from a different video with the same name never
 * matches). Newest plan wins. Plain data in, plain data out.
 */
export function planForTake(recents: readonly RecentEntry[], take: Pick<TakeEntry, "name" | "savedAt">): RecentEntry | null {
  if (!take?.name) return null;
  const keptAt = Date.parse(take.savedAt);
  let best: RecentEntry | null = null;
  let bestAt = -Infinity;
  for (const r of recents) {
    if (!r || r.videoName !== take.name) continue;
    const at = Date.parse(r.savedAt);
    if (Number.isNaN(at)) continue;
    if (!Number.isNaN(keptAt) && at < keptAt) continue;
    if (at > bestAt) {
      best = r;
      bestAt = at;
    }
  }
  return best;
}

/** "Plan made: Sanctuary stage · 6 problems" (1 problem / no problems found). */
export function takePlanLine(entry: Pick<RecentEntry, "spaceName" | "problems">): string {
  const name = (entry.spaceName ?? "").trim() || "Walkthrough";
  const n = Number.isFinite(entry.problems) && entry.problems > 0 ? Math.floor(entry.problems) : 0;
  const count = n === 0 ? "no problems found" : n === 1 ? "1 problem" : `${n} problems`;
  return `Plan made: ${name} · ${count}`;
}
