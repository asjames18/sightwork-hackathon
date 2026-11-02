/** The problems named on the plan's summary card: worst first, one per line, at most `max`, then a count of the rest. */
export type SummaryTitles = { items: { rank: number; title: string }[]; more: number };

export const SUMMARY_TITLES_MAX = 4;

export function summaryTitles(issues: readonly { rank: number; title: string }[], max = SUMMARY_TITLES_MAX): SummaryTitles {
  const named = issues
    .map((i) => ({ rank: i.rank, title: String(i.title ?? "").replace(/\s+/g, " ").trim() }))
    .filter((i) => i.title.length > 0);
  const cap = Math.max(1, Math.floor(Number.isFinite(max) ? max : SUMMARY_TITLES_MAX));
  // Showing "+1 more" costs a line, so show that last one instead.
  const shown = named.length <= cap + 1 ? named : named.slice(0, cap);
  return { items: shown, more: named.length - shown.length };
}

/** "+3 more below" under the list, or null when every problem is shown. */
export function summaryMoreLine(more: number): string | null {
  return more > 0 ? `+${more} more below` : null;
}
