/**
 * Per-step checks: cheap, deterministic notes on each step's output, shown under the finished step on the
 * processing screen ("Transcript: 142 words", "Counts match the outlines"). No model calls.
 * Pure (plan types only), so the pipeline can import the same rules it streams, and the preview runner can
 * show the same notes for the plan it ends on.
 */
import { masksAvailable, type RunStep, type StepCheck, type WorkPlan } from "./types";
import { reviewTally } from "./review";

/** Longest note the screen shows. */
export const MAX_CHECK_NOTE = 120;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Checks an untrusted check from a status line; null when it isn't one. */
export function parseStepCheck(v: unknown): StepCheck | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.ok !== "boolean" || typeof o.note !== "string") return null;
  const note = o.note.replace(/\s+/g, " ").trim();
  if (!note) return null;
  return { ok: o.ok, note: note.length > MAX_CHECK_NOTE ? `${note.slice(0, MAX_CHECK_NOTE - 1).trimEnd()}…` : note };
}

/** Words in the narration, from the turns when present, else the "[12.4] text" transcript lines. */
export function transcriptWords(plan: Pick<WorkPlan, "transcript" | "transcriptTurns">): number {
  const text = plan.transcriptTurns?.length
    ? plan.transcriptTurns.map((t) => t.text).join(" ")
    : (plan.transcript ?? "").replace(/^\s*\[[\d.]+\]\s*/gm, " ");
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Frames sent: count, plus how many ticks were swapped for a sharper neighbour when the browser knows. */
export function uploadCheck(frameCount: number, sharpSwaps = 0): StepCheck {
  if (frameCount <= 0) return { ok: false, note: "No frames came through" };
  return { ok: true, note: `${plural(frameCount, "frame")}${sharpSwaps > 0 ? `, ${sharpSwaps} swapped for a sharper one` : ""}` };
}

/**
 * Notes for every step this plan can vouch for. Steps the plan can't speak to (skipped, or no data)
 * have no entry. `sharpSwaps` comes from the browser's frame builder when known.
 */
export function stepChecksForPlan(plan: WorkPlan, opts: { sharpSwaps?: number } = {}): Partial<Record<RunStep, StepCheck>> {
  const out: Partial<Record<RunStep, StepCheck>> = {};
  const frames = plan.frames ?? [];
  if (frames.length > 0) out.uploading = uploadCheck(frames.length, opts.sharpSwaps);

  const narrated = Boolean(plan.transcript?.trim()) || (plan.transcriptTurns?.length ?? 0) > 0;
  const words = narrated ? transcriptWords(plan) : 0;
  out.listening = narrated ? { ok: words > 0, note: `Transcript: ${plural(words, "word")}` } : { ok: true, note: "No narration in this video" };

  if (masksAvailable(plan) && plan.inventory.length > 0) {
    const noOutline = plan.inventory.filter((i) => i.method !== "sam" && i.method !== "sam+model").length;
    out.counting =
      noOutline === 0
        ? { ok: true, note: "Counts match the outlines" }
        : { ok: false, note: `${plural(noOutline, "count")} had no outline, marked estimated` };
  }

  if (narrated) {
    const said = plan.issues.filter((i) => !i.unmentioned).length;
    const notSaid = plan.issues.length - said;
    out.comparing = { ok: true, note: `${said} you mentioned, ${notSaid} you didn't` };
  }

  const n = plan.issues.length;
  const withProof = plan.issues.filter((i) => i.status !== "mentioned_not_seen" && (frames.length === 0 || Boolean(frames[i.frameIndex]))).length;
  out.planning =
    n === 0
      ? { ok: true, note: "Plan: no problems found" }
      : withProof === n
        ? { ok: true, note: `Plan: ${plural(n, "problem")}, each with a proof frame` }
        : { ok: false, note: `Plan: ${withProof} of ${plural(n, "problem")} have a proof frame` };

  if (plan.afterImageUrl) out.picturing = { ok: true, note: "After picture made" };

  if (plan.review) {
    const t = reviewTally(plan.review);
    out.reviewing = !plan.review.ran
      ? { ok: false, note: "Review didn't run" }
      : t
        ? { ok: t.verified === t.total, note: `${t.verified} of ${plural(t.total, "problem")} backed by a photo` }
        : { ok: true, note: "Nothing to review" };
  }
  return out;
}
