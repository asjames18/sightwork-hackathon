/**
 * How old a saved plan is, for the note on the plan screen. A plan's prices and the room itself drift, so
 * one made a week or more ago says so and offers a fresh walkthrough. Pure helpers; no storage, no network.
 */

/** Days after which a plan gets the note. */
export const OLD_PLAN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PlanAge = { days: number; text: string };

/** Whole days between the plan's saved time and now, or null when the time is missing, unreadable or in the future. */
export function planAgeDays(savedAt: string | null | undefined, now: Date): number | null {
  if (!savedAt) return null;
  const then = new Date(savedAt).getTime();
  if (!Number.isFinite(then)) return null;
  const diff = now.getTime() - then;
  if (diff < 0) return null;
  return Math.floor(diff / DAY_MS);
}

/** "Oct 22, 2026". */
function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The note for a plan made OLD_PLAN_DAYS or more days ago; null for a newer plan or an unreadable time. */
export function planAgeNote(savedAt: string | null | undefined, now: Date): PlanAge | null {
  const days = planAgeDays(savedAt, now);
  if (days === null || days < OLD_PLAN_DAYS) return null;
  const made = dayLabel(new Date(savedAt as string));
  const ago = days >= 60 ? `${Math.floor(days / 30)} months ago` : days >= 14 ? `${Math.floor(days / 7)} weeks ago` : `${days} days ago`;
  return {
    days,
    text: `This plan was made ${ago} (${made}). Prices and the room may have changed since, so film it again to check.`,
  };
}
