import type { WorkPlan } from "@/lib/types";
import { SIGNOFF_LINE } from "./siteUrl";
import { MAX_SHARE_CHARS, planLocation, shareDate } from "./planText";

/** Sign-off for the donation request: a full link, so a store owner who gets it by text can tap through. */
export const DONATION_SIGNOFF = SIGNOFF_LINE;

/** Most items listed by name; a longer list ends with "and N more". */
export const MAX_DONATION_ITEMS = 12;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export interface DonationRequestOptions {
  maxChars?: number;
  sample?: boolean;
  /** Date shown in the header. Default: now. */
  date?: Date;
}

/** Share-sheet title for a donation request. */
export function donationRequestTitle(plan: Pick<WorkPlan, "spaceName">): string {
  return `Donation request: ${clean(plan.spaceName) || "work day"}`;
}

/**
 * A short, plain note to a hardware store, lumber yard or local business asking whether it could donate or
 * discount the materials still on the shopping list: what the project is, the items and amounts, and what
 * to answer. It never shares the plan's cost range or any item price.
 * Items already ticked off are left out. Empty string when nothing is left to ask for.
 */
export function donationRequestText(
  plan: Pick<WorkPlan, "spaceName" | "materials" | "costRange" | "meta">,
  got: number[] = [],
  opts: DonationRequestOptions = {},
): string {
  const have = new Set(got);
  const need = (plan.materials ?? []).map((m, i) => ({ m, i })).filter(({ i }) => !have.has(i));
  if (need.length === 0) return "";
  const maxChars = opts.maxChars ?? MAX_SHARE_CHARS;
  const date = opts.date ?? new Date();
  const sample = opts.sample ?? plan.meta?.isExample === true;
  const space = clean(plan.spaceName) || "our building";

  const lines: string[] = [];
  lines.push(`Donation request: ${space}`);
  lines.push([planLocation(plan as WorkPlan), shareDate(date)].filter(Boolean).join(" · "));
  if (sample) lines.push("Example plan with sample data, not a real project.");
  lines.push(
    "",
    `Hello, we are a volunteer team fixing up ${space}. Would you be able to donate, or give us a discount on, any of the materials below?`,
    "",
  );
  for (const { m } of need.slice(0, MAX_DONATION_ITEMS)) lines.push(`- ${clean(m.item)}: ${clean(m.qty)}`);
  if (need.length > MAX_DONATION_ITEMS) lines.push(`- and ${need.length - MAX_DONATION_ITEMS} more`);

  lines.push("", "Please reply with:");
  lines.push("- what you could donate, and what you could sell us at a discount");
  lines.push("- when we could pick it up, or whether you can deliver");
  lines.push("- anything you need from us, such as a letter or a receipt");
  lines.push("", "We are happy to answer any questions about the project.", "", DONATION_SIGNOFF);

  const text = lines.join("\n");
  if (text.length <= maxChars) return text;
  const tail = `\n...\nShortened for a text.\n\n${DONATION_SIGNOFF}`;
  const body = lines.slice(0, -2).join("\n");
  const cut = body.slice(0, Math.max(0, maxChars - tail.length));
  const atLine = cut.lastIndexOf("\n");
  return (atLine > 0 ? cut.slice(0, atLine) : cut) + tail;
}
