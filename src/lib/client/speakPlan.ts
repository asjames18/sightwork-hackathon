import type { Issue, WorkPlan, WorkStep } from "@/lib/types";
import { TIER_LABEL, issueTier, rankedIssues } from "@/lib/planExtras";
import { planLocation } from "./planText";

/**
 * "Read the plan aloud": the plan as short spoken pieces for the browser's speech voice, so a crew can
 * listen with their hands full. The pieces follow the screen (problems worst first, then the order of work,
 * then the rough cost) and are kept short, because some browsers cut a long utterance off partway.
 */

/** How many problems and steps are read in full; the rest are pointed to on the screen. */
export const SPEAK_MAX_PROBLEMS = 8;
export const SPEAK_MAX_STEPS = 10;
/** Longest single spoken piece, in characters. */
export const SPEAK_MAX_CHARS = 220;

const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const sentence = (s: string): string => (s && !/[.!?]$/.test(s) ? `${s}.` : s);
const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} dollars`;
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** The first sentence or two of a detail, cut at a sentence end so it never stops mid-thought. */
export function shortDetail(detail: unknown, max = 160): string {
  // A narrated plan opens the detail with what was said ('Said at 9 s: "..."'); that is on screen, so skip it.
  const t = clean(detail).replace(/^Said at [\d.]+ ?s:\s*["\u201c][^"\u201d]*["\u201d]\s*/i, "");
  if (!t) return "";
  const parts = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [t];
  let out = "";
  for (const p of parts) {
    const next = (out ? `${out} ${p.trim()}` : p.trim());
    if (out && next.length > max) break;
    out = next;
    if (out.length >= max) break;
  }
  if (out.length <= max) return out;
  return `${out.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "")}.`;
}

/** Splits one long piece at sentence ends, then at commas, then at spaces, so each part fits `max`. */
export function splitForSpeech(text: string, max = SPEAK_MAX_CHARS): string[] {
  const t = clean(text);
  if (!t) return [];
  if (t.length <= max) return [t];
  const out: string[] = [];
  let cur = "";
  const push = (piece: string) => {
    if (!cur) cur = piece;
    else if (`${cur} ${piece}`.length <= max) cur = `${cur} ${piece}`;
    else {
      out.push(cur);
      cur = piece;
    }
  };
  for (const s of t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [t]) {
    const piece = s.trim();
    if (piece.length <= max) {
      push(piece);
      continue;
    }
    for (const c of piece.split(/(?<=,)\s+/)) {
      if (c.length <= max) {
        push(c);
        continue;
      }
      let rest = c;
      while (rest.length > max) {
        const at = rest.lastIndexOf(" ", max);
        const cut = at > 0 ? at : max;
        push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      if (rest) push(rest);
    }
  }
  if (cur) out.push(cur);
  return out;
}

function problemPiece(issue: Issue): string {
  const tier = TIER_LABEL[issueTier(issue)];
  const title = sentence(clean(issue.title) || "A problem");
  const area = clean((issue as unknown as { area?: unknown }).area);
  const where = area ? ` ${sentence(`Where: ${area}`)}` : "";
  const detail = shortDetail(issue.detail);
  const lead = finite(issue.rank) ? `Problem ${issue.rank}, ${tier}.` : `${tier}.`;
  return `${lead} ${title}${where}${detail ? ` ${detail}` : ""}`;
}

function stepPiece(step: WorkStep, index: number): string {
  const n = finite(step.order) ? step.order : index + 1;
  const title = sentence(clean(step.title) || "A step");
  const trade = clean(step.trade);
  const h = Array.isArray(step.hours) && step.hours.length === 2 && step.hours.every((x) => finite(x) && x >= 0) ? step.hours : null;
  const who = trade ? ` Who: ${sentence(trade)}` : "";
  const time = h ? ` About ${h[0] === h[1] ? h[0] : `${h[0]} to ${h[1]}`} ${plural(h[1], "hour")}.` : "";
  return `Step ${n}. ${title}${who}${time}`;
}

/** The plan as spoken pieces, in reading order. Never empty. */
export function speakPlanParts(plan: WorkPlan): string[] {
  const parts: string[] = [];
  const name = clean(plan.spaceName) || "this space";
  const place = planLocation(plan);
  parts.push(`Work plan for ${name}${place ? `, ${place}` : ""}.`);

  const issues = Array.isArray(plan.issues) ? rankedIssues(plan) : [];
  if (issues.length === 0) {
    parts.push("No problems were found in this walkthrough.");
  } else {
    parts.push(`${issues.length} ${plural(issues.length, "problem")} found, worst first.`);
    for (const i of issues.slice(0, SPEAK_MAX_PROBLEMS)) parts.push(...splitForSpeech(problemPiece(i)));
    if (issues.length > SPEAK_MAX_PROBLEMS) {
      const more = issues.length - SPEAK_MAX_PROBLEMS;
      parts.push(`${more} more ${plural(more, "problem")} on the screen.`);
    }
  }

  const steps = Array.isArray(plan.workOrder) ? plan.workOrder : [];
  if (steps.length > 0) {
    parts.push(`The work, in order: ${steps.length} ${plural(steps.length, "step")}.`);
    steps.slice(0, SPEAK_MAX_STEPS).forEach((s, i) => parts.push(...splitForSpeech(stepPiece(s, i))));
    if (steps.length > SPEAK_MAX_STEPS) {
      const more = steps.length - SPEAK_MAX_STEPS;
      parts.push(`${more} more ${plural(more, "step")} on the screen.`);
    }
  }

  const c = plan.costRange;
  if (c && finite(c.low) && finite(c.high)) {
    const where = clean(c.region);
    parts.push(`Rough cost: ${money(c.low)} to ${money(c.high)}${where ? ` in ${where}` : ""}. This is an estimate, not a quote.`);
  }
  return parts;
}

/** The speech API the button needs, so it can be passed in tests. */
export interface SpeechLike {
  speechSynthesis?: { speak: unknown; cancel: unknown };
  SpeechSynthesisUtterance?: unknown;
}

/** True when this browser can speak text. */
export function canReadAloud(win: SpeechLike | undefined | null): boolean {
  return !!win && typeof win.SpeechSynthesisUtterance === "function" && !!win.speechSynthesis && typeof win.speechSynthesis.speak === "function" && typeof win.speechSynthesis.cancel === "function";
}

/** What the live region says for each state of the button. */
export function readAloudStatus(state: "idle" | "reading" | "stopped"): string {
  if (state === "reading") return "Reading the plan aloud. Press Stop reading to stop.";
  if (state === "stopped") return "Stopped reading.";
  return "";
}

/** Where the reading is, as a short line like "Part 3 of 14". Empty until a piece has started. */
export function readAloudProgress(part: number, total: number): string {
  if (!Number.isInteger(part) || !Number.isInteger(total) || total < 1 || part < 1) return "";
  return `Part ${Math.min(part, total)} of ${total}`;
}
