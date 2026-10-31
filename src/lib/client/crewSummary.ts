import type { WorkStep } from "@/lib/types";

/** One row of the "Who does the work" summary: a trade (or volunteers) and the steps it covers. */
export interface CrewRow {
  /** Display label: the trade as the plan wrote it, or "Volunteers". */
  label: string;
  /** false for volunteer work (same rule as the step chip: the trade mentions "volunteer"). */
  paid: boolean;
  /** Step numbers, ascending. */
  steps: number[];
  /** Summed hour range across those steps, or null when none of them has hours. */
  hours: [number, number] | null;
  /** true when at least one of the steps had no hours, so the range is a floor. */
  hoursPartial: boolean;
}

export interface CrewSummary {
  rows: CrewRow[];
  /** Steps with no trade at all, ascending. */
  unassigned: number[];
  /** Summed hour range across every step that has hours, or null. */
  totalHours: [number, number] | null;
  /** true when some steps had no hours, so the total is a floor. */
  totalPartial: boolean;
}

export const isVolunteerTrade = (trade: string): boolean => /volunteer/i.test(trade);

const round = (n: number) => Math.round(n * 10) / 10;

function sumHours(steps: WorkStep[]): { hours: [number, number] | null; partial: boolean } {
  let lo = 0;
  let hi = 0;
  let any = false;
  let missing = false;
  for (const s of steps) {
    const h = s.hours;
    if (h && Number.isFinite(h[0]) && Number.isFinite(h[1]) && h[0] >= 0 && h[1] >= 0) {
      lo += Math.min(h[0], h[1]);
      hi += Math.max(h[0], h[1]);
      any = true;
    } else {
      missing = true;
    }
  }
  return { hours: any ? [round(lo), round(hi)] : null, partial: any && missing };
}

/**
 * Groups the work order by who does it, so a leader can see who to book before reading every step.
 * Paid trades come first (in the order they first appear), then one "Volunteers" row. Trade names are
 * matched case- and space-insensitively and shown as first written, first letter capitalized.
 */
export function crewSummary(workOrder: WorkStep[]): CrewSummary {
  const steps = [...workOrder].sort((a, b) => a.order - b.order);
  const paid = new Map<string, { label: string; steps: WorkStep[] }>();
  const volunteers: WorkStep[] = [];
  const unassigned: number[] = [];
  for (const s of steps) {
    const trade = s.trade?.trim().replace(/\s+/g, " ");
    if (!trade) {
      unassigned.push(s.order);
    } else if (isVolunteerTrade(trade)) {
      volunteers.push(s);
    } else {
      const key = trade.toLowerCase();
      const row = paid.get(key) ?? { label: trade.charAt(0).toUpperCase() + trade.slice(1), steps: [] };
      row.steps.push(s);
      paid.set(key, row);
    }
  }
  const toRow = (label: string, isPaid: boolean, list: WorkStep[]): CrewRow => {
    const { hours, partial } = sumHours(list);
    return { label, paid: isPaid, steps: list.map((s) => s.order), hours, hoursPartial: partial };
  };
  const rows = [...paid.values()].map((r) => toRow(r.label, true, r.steps));
  if (volunteers.length) rows.push(toRow("Volunteers", false, volunteers));
  const total = sumHours(steps);
  return { rows, unassigned, totalHours: total.hours, totalPartial: total.partial };
}

/** "Step 3" / "Steps 1, 4 and 6". */
export function stepsLabel(steps: number[]): string {
  if (steps.length === 0) return "";
  if (steps.length === 1) return `Step ${steps[0]}`;
  return `Steps ${steps.slice(0, -1).join(", ")} and ${steps[steps.length - 1]}`;
}

/** "about 3–6 h", "about 2 h", "at least 3–6 h" when some steps had no hours. */
export function hoursLabel(hours: [number, number] | null, partial: boolean): string | null {
  if (!hours) return null;
  const r = hours[0] === hours[1] ? `${hours[0]}` : `${hours[0]}–${hours[1]}`;
  return `${partial ? "at least" : "about"} ${r} h`;
}

/** Show the summary only when it adds something: at least two different groups. */
export function showCrewSummary(summary: CrewSummary): boolean {
  return summary.rows.length + (summary.unassigned.length ? 1 : 0) >= 2;
}
