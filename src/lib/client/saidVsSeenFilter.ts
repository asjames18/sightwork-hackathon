import type { SaidVsSeenEntry } from "@/lib/types";
import { saidVsSeenKind } from "./planText";

type Row = Pick<SaidVsSeenEntry, "status" | "seen">;

/** How many rows are things the walker never said but the video shows. */
export function unmentionedCount(rows: ReadonlyArray<Row> | null | undefined): number {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((r) => saidVsSeenKind(r) === "unmentioned").length;
}

/** The toggle only helps when there is something to hide: at least one unmentioned row and at least one other row. */
export function canFilterUnmentioned(rows: ReadonlyArray<Row> | null | undefined): boolean {
  const n = unmentionedCount(rows);
  return n > 0 && Array.isArray(rows) && n < rows.length;
}

/** Whether a row stays on screen with the filter on or off. */
export function showSaidVsSeenRow(row: Row, onlyUnmentioned: boolean): boolean {
  return !onlyUnmentioned || saidVsSeenKind(row) === "unmentioned";
}

/** Button text: "Show only what you didn't mention (3)" or "Show all 6 rows". */
export function unmentionedToggleLabel(rows: ReadonlyArray<Row>, onlyUnmentioned: boolean): string {
  return onlyUnmentioned ? `Show all ${rows.length} rows` : `Show only what you didn't mention (${unmentionedCount(rows)})`;
}

/** Short line under the button while the filter is on: "Hiding 3 rows you mentioned." */
export function hiddenSaidRowsLine(rows: ReadonlyArray<Row>, onlyUnmentioned: boolean): string {
  if (!onlyUnmentioned) return "";
  const hidden = rows.length - unmentionedCount(rows);
  if (hidden <= 0) return "";
  return `Hiding ${hidden} ${hidden === 1 ? "row" : "rows"} you mentioned.`;
}
