import type { WorkPlan, WorkStep } from "@/lib/types";
import { hoursLabel, type CrewRow } from "./crewSummary";
import { SIGNOFF_LINE } from "./siteUrl";
import { MAX_SHARE_CHARS, planLocation, shareDate } from "./planText";
import { tradeMayNeedPermit } from "./permitTrade";

/** Sign-off for the quote request: a full link, so a trade who gets it by text can tap through. */
export const QUOTE_SIGNOFF = SIGNOFF_LINE;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const span = (r: [number, number]) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`);
const validHours = (h: WorkStep["hours"]): h is [number, number] =>
  Array.isArray(h) && Number.isFinite(h[0]) && Number.isFinite(h[1]) && h[0] >= 0 && h[1] >= 0;

export interface QuoteRequestOptions {
  maxChars?: number;
  sample?: boolean;
  /** Date shown in the header. Default: now. */
  date?: Date;
}

/** Share-sheet title for a quote request. */
export function quoteRequestTitle(plan: Pick<WorkPlan, "spaceName">, trade: string): string {
  return `Quote request: ${clean(trade) || "paid work"}, ${clean(plan.spaceName) || "work day"}`;
}

/**
 * A short, plain request for a quote to send to a trade (electrician, plumber and so on): what the job is,
 * which problems it fixes, the rough hours the plan expects, which steps must finish first, and what to
 * answer (price, start date, whether materials and a permit are included). It is built only from the
 * paid steps of that one trade; it never shares the plan's own cost range, so the reply is the trade's own
 * price. Null for a volunteer row or a row with no steps.
 */
export function quoteRequestText(
  plan: WorkPlan,
  crew: Pick<CrewRow, "label" | "paid" | "steps" | "hours" | "hoursPartial">,
  opts: QuoteRequestOptions = {},
): string | null {
  if (!crew.paid) return null;
  const byOrder = new Map(plan.workOrder.map((s) => [s.order, s]));
  const ours = crew.steps.map((n) => byOrder.get(n)).filter((s): s is WorkStep => Boolean(s));
  if (ours.length === 0) return null;
  const mine = new Set(ours.map((s) => s.order));
  const maxChars = opts.maxChars ?? MAX_SHARE_CHARS;
  const sample = opts.sample ?? plan.meta?.isExample === true;
  const trade = clean(crew.label) || "trade";
  const space = clean(plan.spaceName) || "our building";

  const lines: string[] = [];
  lines.push(`Quote request: ${trade}, ${space}`);
  lines.push([planLocation(plan), shareDate(opts.date ?? new Date())].filter(Boolean).join(" · "));
  if (sample) lines.push("Example plan with sample data, not a real job.");
  lines.push("", `Hello, we are looking for a quote for ${trade.toLowerCase()} work at ${space}. Here is the job:`);

  lines.push("", "The work:");
  for (const s of ours) lines.push(`- ${clean(s.title)}${validHours(s.hours) ? ` (we expect about ${span(s.hours)} h)` : ""}`);

  const hrs = hoursLabel(crew.hours, crew.hoursPartial);
  if (hrs && ours.length > 1) lines.push("", `That is ${hrs} of work in all, by our own rough estimate. Please tell us if you see it differently.`);

  const known = new Map(plan.issues.map((i) => [i.rank, i]));
  const problems: string[] = [];
  for (const s of ours) {
    for (const r of s.fixes ?? []) {
      const title = clean(known.get(r)?.title ?? "");
      if (title && !problems.includes(title)) problems.push(title);
    }
  }
  if (problems.length > 0) {
    lines.push("", "What it is meant to fix:");
    for (const p of problems) lines.push(`- ${p}`);
  }

  const waits = ours.flatMap((s) => {
    const dep = s.dependsOn != null ? byOrder.get(s.dependsOn) : undefined;
    return dep && !mine.has(dep.order) ? [{ step: s, dep }] : [];
  });
  if (waits.length > 0) lines.push("");
  for (const { step, dep } of waits) {
    const who = clean(dep.trade ?? "");
    lines.push(`"${clean(step.title)}" comes after ${who ? `the ${who} finishes ` : ""}"${clean(dep.title)}".`);
  }

  const permit = tradeMayNeedPermit(crew.label);
  lines.push("", "Please reply with:");
  lines.push("- your price, and whether it includes materials");
  lines.push("- the earliest day you could start, and how long it will take");
  lines.push("- your license and insurance, if your trade needs them");
  if (permit) lines.push("- whether a permit is needed, and who pulls it");
  lines.push("", "We can send photos of each spot, or you are welcome to walk through first.", "", QUOTE_SIGNOFF);

  const text = lines.join("\n");
  if (text.length <= maxChars) return text;
  const tail = `\n...\nShortened for a text.\n\n${QUOTE_SIGNOFF}`;
  const body = lines.slice(0, -2).join("\n");
  const cut = body.slice(0, Math.max(0, maxChars - tail.length));
  const atLine = cut.lastIndexOf("\n");
  return (atLine > 0 ? cut.slice(0, atLine) : cut) + tail;
}
