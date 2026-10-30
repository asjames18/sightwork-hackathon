/**
 * Prompt 06 builder for the reviewer pass ("reviewing" step).
 *
 * runPlan picks the proof photos (pickReviewFrames / buildReviewPhotos) and hands them here
 * with the finished plan's issues; this fills prompt 06's placeholders and returns the finished
 * prompt text. Pure and synchronous: no calls, no keys, no clock. The route passes it as
 * `reviewPrompt` next to the review caller.
 *
 * Placeholders, as the prompt spec defines them:
 * - space_type: request spaceType, default "church sanctuary"
 * - photo_list: one line per attached photo, "Photo A: frame 6 at 0:30", in attach order
 * - problem_list: one line per issue in rank order,
 *   "id 1 | high | <title> | <detail> | proof: Photo A (caption), Photo B", or "proof: none"
 * - problem_count: issues.length
 * - schema: REVIEW_SCHEMA, pretty-printed
 */
import { REVIEW_SCHEMA } from "./pipeline/review";
import type { ReviewPromptInput } from "./pipeline/runPlan";

export const DEFAULT_REVIEW_SPACE_TYPE = "church sanctuary";

export const REVIEW_PROMPT_TEMPLATE = `You are checking a work plan that someone else wrote from a walkthrough video of a {{space_type}}. You did not write it and you cannot change it.

You get the plan's problems and the photos the plan points to as proof. The photos are attached in this order:
{{photo_list}}

Problems ({{problem_count}}):
{{problem_list}}

For each problem, decide only whether the attached photos visibly show it.
- verified = true only when something you can see in at least one attached photo supports the problem as written.
- verified = false when the photos don't show it, show something different, or the problem depends on something a photo can't show (a sound, a smell, what is inside a wall, a code rule). A problem with "proof: none" is false.
- reason: one plain sentence, at most 140 characters, that names the photo you used, for example "Photo B shows two cords across the steps." For false, say what is missing.
Don't suggest fixes, don't reword the problems, don't add new problems, and answer for every id exactly once.

Set "ran" to true. Add a one-sentence "summary" if you like, for example "3 of 4 problems are visible in their photos."

Return only JSON that matches this schema, with no other text and no code fences:
{{schema}}`;

/** m:ss, rounded to the nearest second. */
export const reviewTime = (sec: number): string => {
  const s = Math.max(0, Math.round(Number.isFinite(sec) ? sec : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** One line of plain text: no newlines, no pipes (the problem line's separator), trimmed. */
const field = (s: unknown): string =>
  (typeof s === "string" ? s : "").replace(/\s+/g, " ").replace(/\|/g, "/").trim();

/** Each issue's attached photos, by letter, in its own order (primary first, then proofFrames). */
function proofFor(issue: ReviewPromptInput["issues"][number], letterOf: Map<number, string>): string {
  const seen = new Set<number>();
  const parts: string[] = [];
  const caps = new Map<number, string>();
  for (const pf of issue.proofFrames ?? []) {
    const c = field(pf.caption);
    if (c && !caps.has(pf.frameIndex)) caps.set(pf.frameIndex, c);
  }
  for (const fi of [issue.frameIndex, ...(issue.proofFrames ?? []).map((p) => p.frameIndex)]) {
    const letter = letterOf.get(fi);
    if (letter === undefined || seen.has(fi)) continue;
    seen.add(fi);
    const cap = caps.get(fi);
    parts.push(cap ? `Photo ${letter} (${cap})` : `Photo ${letter}`);
  }
  return parts.length ? parts.join(", ") : "none";
}

/** Prompt 06 with every placeholder filled from the finished plan and the selected photos. */
export function buildReviewPrompt(input: ReviewPromptInput): string {
  const letterOf = new Map(input.photos.map((p) => [p.frameIndex, p.letter]));
  const photoList = input.photos.length
    ? input.photos.map((p) => `Photo ${p.letter}: frame ${p.frameIndex} at ${reviewTime(p.tSec)}`).join("\n")
    : "(no photos)";
  const issues = [...input.issues].sort((a, b) => a.rank - b.rank);
  const problemList = issues
    .map((i) => `id ${i.rank} | ${field(i.severity)} | ${field(i.title)} | ${field(i.detail)} | proof: ${proofFor(i, letterOf)}`)
    .join("\n");
  const values: Record<string, string> = {
    space_type: field(input.spaceType) || DEFAULT_REVIEW_SPACE_TYPE,
    photo_list: photoList,
    problem_count: String(issues.length),
    problem_list: problemList,
    schema: JSON.stringify(REVIEW_SCHEMA, null, 2),
  };
  // One pass, so a value that happens to contain "{{...}}" is never filled a second time.
  return REVIEW_PROMPT_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (m, k: string) => values[k] ?? m);
}
