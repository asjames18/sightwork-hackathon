import type { SaidVsSeenEntry } from "@/lib/types";
import { SAID_VS_SEEN_HEADING, SHARE_SIGNOFF, saidVsSeenKind } from "./planText";
import { showSaidVsSeenRow } from "./saidVsSeenFilter";

/**
 * The "You said / We saw" rows on screen as plain text, for sending by share sheet or clipboard. Follows the
 * "only what you didn't mention" toggle, so what's sent is what's shown.
 *
 *   What you said vs. what we saw · Sanctuary stage
 *   You didn't mention (2):
 *   - Frayed cable under the pulpit (problem 1)
 *   - Exit sign out by the side door
 *   Check in person (1):
 *   - Said "the back door sticks" (41 s), not visible in the video
 *   Matched (1):
 *   - "Ceiling is open" (9 s): Loose plaster overhead
 */
export interface SaidVsSeenTextOptions {
  spaceName?: string;
  /** Example or sample plan: say so, so a forwarded example is never mistaken for a real walk. */
  sample?: boolean;
  /** The toggle is on: only rows the walker didn't mention. */
  onlyUnmentioned?: boolean;
}

const oneLine = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const secs = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? ` (${n.toFixed(0)} s)` : "");
const problem = (rank: unknown) => (typeof rank === "number" && Number.isInteger(rank) && rank > 0 ? ` (problem ${rank})` : "");

export function saidVsSeenShareTitle(spaceName?: string): string {
  const space = oneLine(spaceName);
  return space ? `What we caught: ${space}` : "What we caught";
}

/** One row as a list line, or null when the row has nothing to say. */
export function saidVsSeenRowLine(row: SaidVsSeenEntry): string | null {
  const kind = saidVsSeenKind(row);
  const quote = oneLine(row.said?.quote);
  const seen = oneLine(row.seen?.summary);
  const said = quote ? `\u201C${quote}\u201D${secs(row.said?.atSec)}` : "";
  if (kind === "unmentioned") return seen ? `- ${seen}${problem(row.issueRank)}` : null;
  if (kind === "notSeen") return said ? `- Said ${said}, not visible in the video` : null;
  if (!seen) return null;
  return said ? `- ${said}: ${seen}${problem(row.issueRank)}` : `- ${seen}${problem(row.issueRank)}`;
}

const GROUPS = [
  { kind: "unmentioned", label: "You didn't mention" },
  { kind: "notSeen", label: "Check in person" },
  { kind: "matched", label: "Matched" },
] as const;

/** Null when no row on screen has anything to send. */
export function saidVsSeenToText(rows: readonly SaidVsSeenEntry[] | null | undefined, opts: SaidVsSeenTextOptions = {}): string | null {
  if (!Array.isArray(rows)) return null;
  const shown = rows.filter((r) => r && typeof r === "object" && showSaidVsSeenRow(r, opts.onlyUnmentioned === true));
  const body: string[] = [];
  for (const g of GROUPS) {
    const lines = shown.filter((r) => saidVsSeenKind(r) === g.kind).map(saidVsSeenRowLine).filter((l): l is string => l !== null);
    if (lines.length === 0) continue;
    body.push(`${g.label} (${lines.length}):`, ...lines);
  }
  if (body.length === 0) return null;
  const out: string[] = [];
  if (opts.sample) out.push("Example plan, not a real walkthrough.");
  const space = oneLine(opts.spaceName);
  out.push(space ? `${SAID_VS_SEEN_HEADING} · ${space}` : SAID_VS_SEEN_HEADING);
  out.push(...body, "", SHARE_SIGNOFF);
  return out.join("\n");
}
