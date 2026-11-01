import type { Issue, PlanReviewItem, WorkStep } from "@/lib/types";
import { issueExtras, issueTier, TIER_LABEL } from "@/lib/planExtras";
import { issueNote, SHARE_SIGNOFF } from "@/lib/client/planText";
import { stepsFixing } from "@/lib/client/stepLinks";

/**
 * One problem as plain text, for handing a single problem to a single person (a volunteer, a trade) by share sheet
 * or clipboard. Same words as the plan screen and the full "Send to your team" text, so nothing reads differently.
 *
 *   Problem #2 · Fix now
 *   Loose cable across the stage edge
 *   Where: front left of the stage
 *   Photo shows: black cable on stage floor near front edge
 *   High priority. Spotted on video, not mentioned on the walk.
 *   <detail>
 *   Fixed in step 3: Tape down stage cables
 *   Space: Hope City sanctuary
 */
export interface ProblemTextOptions {
  spaceName?: string;
  narrated: boolean;
  verdict?: PlanReviewItem;
  workOrder?: readonly WorkStep[];
  /** Example or sample plan: say so, so a forwarded example is never mistaken for a real inspection. */
  sample?: boolean;
}

const oneLine = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** "Fixed in step 3: Tape down cables" or "Fixed in steps 2 and 4: A; B"; null when no step fixes it. */
export function fixedInLine(workOrder: readonly WorkStep[] | undefined, rank: number): string | null {
  const steps = workOrder ?? [];
  const orders = stepsFixing(steps, rank);
  if (orders.length === 0) return null;
  const titles = orders.map((n) => oneLine(steps.find((s) => s.order === n)?.title)).filter(Boolean);
  const nums = orders.length === 1 ? `step ${orders[0]}` : `steps ${orders.slice(0, -1).join(", ")} and ${orders[orders.length - 1]}`;
  return `Fixed in ${nums}${titles.length ? `: ${titles.join("; ")}` : ""}`;
}

export function problemShareTitle(issue: Pick<Issue, "rank" | "title">): string {
  return `Problem #${issue.rank}: ${oneLine(issue.title)}`;
}

export function problemToText(issue: Issue, opts: ProblemTextOptions): string {
  const { area, evidence } = issueExtras(issue);
  const lines: string[] = [];
  if (opts.sample) lines.push("Example plan, not a real inspection.");
  lines.push(`Problem #${issue.rank} · ${TIER_LABEL[issueTier(issue)]}`);
  lines.push(oneLine(issue.title));
  if (area) lines.push(`Where: ${oneLine(area)}`);
  if (evidence && issue.status !== "mentioned_not_seen") lines.push(`Photo shows: ${oneLine(evidence)}`);
  lines.push(issueNote(issue, opts.narrated, opts.verdict));
  const detail = oneLine(issue.detail);
  if (detail && detail !== oneLine(issue.title)) lines.push(detail);
  const fixed = fixedInLine(opts.workOrder, issue.rank);
  if (fixed) lines.push(fixed);
  const space = oneLine(opts.spaceName);
  if (space) lines.push(`Space: ${space}`);
  lines.push("", SHARE_SIGNOFF);
  return lines.join("\n");
}
