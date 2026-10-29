import { useEffect, useRef } from "react";
import type { PlanStep } from "@/lib/types";
import { currentStepEngines, OPTIONAL_STEPS } from "@/lib/client/engines";

const LABELS: Record<PlanStep, string> = {
  uploading: "Uploading",
  listening: "Listening to what you said",
  looking: "Looking at every frame",
  counting: "Counting what's there",
  comparing: "Comparing what you said with what we saw",
  planning: "Planning the work",
  picturing: "Picturing the finished space",
  done: "Done",
};

/** One plain sentence for the step in progress (fixed per step; the status stream carries no live details). */
const NOW_LINE: Record<PlanStep, string> = {
  uploading: "Sending your video. Bigger files take a little longer.",
  listening: "Turning what you said into a list of requests.",
  looking: "Picking frames from your walkthrough to study.",
  counting: "Counting what's there, roughly.",
  comparing: "Checking what you asked for against what's in the room.",
  planning: "Ranking the problems and putting the work steps in order.",
  picturing: "Drawing a picture of the finished space.",
  done: "Wrapping up your plan.",
};

/** Spoken state for each step, since the circle icons are visual only ("skipped" already shows as text). */
const STATE_TEXT = {
  done: "Done.",
  skipped: "Skipped this run.",
  now: "In progress.",
  failed: "Stopped here.",
  next: "Up next.",
} as const;

/** A step that stopped the run. `message` is shown as-is, so keep it plain and free of provider details. */
export type StepFailure = { message: string };

export function ProcessingStep({
  steps,
  current,
  videoName,
  failure,
  onRetry,
  onExample,
  engines,
  skipped,
}: {
  steps: PlanStep[];
  current: number;
  videoName: string;
  failure?: StepFailure | null;
  onRetry?: () => void;
  onExample?: () => void;
  /** Engine named under each step. Defaults to this page's plan provider (see src/lib/client/engines.ts). */
  engines?: Record<PlanStep, string>;
  /** Optional steps the server skipped this run (e.g. Meta access off). Shown as skipped, not done. */
  skipped?: readonly PlanStep[];
}) {
  const ENGINE = engines ?? currentStepEngines();
  const failed = Boolean(failure);
  // When a run stops, move keyboard and screen-reader focus to "Try again" (focus also scrolls it into
  // view on a phone, where the failure card sits below the step list).
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (failed) retryRef.current?.focus();
  }, [failed]);
  // "done" is the end state, not a step the user waits on, so it doesn't count toward "Step N of M".
  const work = steps.filter((s) => s !== "done");
  const total = Math.max(work.length, 1);
  const position = Math.min(current + 1, total);
  const percent = Math.round(((failed ? current : current + 0.5) / total) * 100);
  return (
    <section aria-live="polite">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{failed ? "We couldn't finish your plan" : "Working on your plan"}</h1>
      <p className="mt-1 truncate text-sm text-ink/65" title={videoName}>
        {videoName}
      </p>

      <div className="mt-5">
        <p className="text-sm font-semibold">
          Step {position} of {total}
        </p>
        <div
          role="progressbar"
          aria-label="Plan progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={current}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${failed ? "bg-red-600" : "bg-accent"}`}
            style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
          />
        </div>
        {!failed && <p className="mt-2 text-sm text-ink/65">Usually about a minute. Keep this tab open.</p>}
      </div>

      <ol className="mt-5 divide-y divide-ink/5 rounded-2xl border border-ink/10 bg-white px-3 sm:px-4">
        {work.map((s, i) => {
          const passed = i < current ? (skipped?.includes(s) ? "skipped" : "done") : null;
          const state: keyof typeof STATE_TEXT = passed ?? (i === current ? (failed ? "failed" : "now") : "next");
          return (
            <li key={s} aria-current={state === "now" ? "step" : undefined} className="flex min-h-[3.25rem] items-center gap-3 py-2.5">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  state === "done"
                    ? "bg-safe-dark text-white"
                    : state === "skipped"
                      ? "border border-dashed border-ink/30 bg-white text-ink/65"
                    : state === "now"
                      ? "bg-accent-dark text-white ring-2 ring-accent/40 ring-offset-2 motion-safe:animate-pulse"
                      : state === "failed"
                        ? "bg-red-600 text-white"
                        : "bg-ink/10 text-ink/70"
                }`}
              >
                {state === "done" ? "✓" : state === "failed" ? "!" : state === "skipped" ? "–" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block break-words leading-snug ${
                    state === "next" ? "text-ink/60" : state === "skipped" ? "font-medium text-ink/65" : "font-medium"
                  }`}
                >
                  {LABELS[s]}
                </span>
                {state === "now" && (
                  <span className="mt-0.5 flex items-start gap-2 text-sm text-ink/80">
                    <span
                      aria-hidden="true"
                      className="mt-[3px] inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-accent/30 border-t-accent-dark motion-safe:animate-spin"
                    />
                    {NOW_LINE[s]}
                  </span>
                )}
                {(ENGINE[s] || state === "skipped") && (
                  <span className="block text-sm text-ink/65">
                    {ENGINE[s] && (s === "uploading" ? ENGINE[s] : <>via {ENGINE[s]}</>)}
                    {state === "skipped" ? (
                      <span>{ENGINE[s] ? " · " : ""}skipped this run</span>
                    ) : (
                      ENGINE[s] && OPTIONAL_STEPS.has(s) && <span> · optional</span>
                    )}
                  </span>
                )}
                {state !== "skipped" && <span className="sr-only">{STATE_TEXT[state]}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {failure && (
        <div role="alert" className="mt-6 rounded-2xl border border-red-600/30 bg-white p-4">
          <p className="font-semibold text-red-700">Stopped at: {LABELS[steps[current]] ?? "a step"}</p>
          <p className="mt-1 text-sm text-ink/70">{failure.message}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {onRetry && (
              <button
                ref={retryRef}
                type="button"
                onClick={onRetry}
                className="min-h-11 flex-1 rounded-xl bg-ink px-4 py-3 font-semibold text-white active:scale-[.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Try again
              </button>
            )}
            {onExample && (
              <button
                type="button"
                onClick={onExample}
                className="min-h-11 flex-1 rounded-xl border border-ink/20 px-4 py-3 font-semibold active:scale-[.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                See the example plan
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
