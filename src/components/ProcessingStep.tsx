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
}: {
  steps: PlanStep[];
  current: number;
  videoName: string;
  failure?: StepFailure | null;
  onRetry?: () => void;
  onExample?: () => void;
  /** Engine named under each step. Defaults to this page's plan provider (see src/lib/client/engines.ts). */
  engines?: Record<PlanStep, string>;
}) {
  const ENGINE = engines ?? currentStepEngines();
  const failed = Boolean(failure);
  // "done" is the end state, not a step the user waits on, so it doesn't count toward "Step N of M".
  const work = steps.filter((s) => s !== "done");
  const total = Math.max(work.length, 1);
  const position = Math.min(current + 1, total);
  const percent = Math.round(((failed ? current : current + 0.5) / total) * 100);
  return (
    <section aria-live="polite">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{failed ? "We couldn't finish your plan" : "Working on your plan"}</h1>
      <p className="mt-1 truncate text-sm text-ink/60" title={videoName}>
        {videoName}
      </p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">
            Step {position} of {total}
          </span>
          {!failed && <span className="text-ink/55">Keep this tab open</span>}
        </div>
        <div
          role="progressbar"
          aria-label="Plan progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={current}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${failed ? "bg-red-600" : "bg-accent"}`}
            style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
          />
        </div>
      </div>

      <ol className="mt-5 divide-y divide-ink/5 rounded-2xl border border-ink/10 bg-white px-3 sm:px-4">
        {work.map((s, i) => {
          const state = i < current ? "done" : i === current ? (failed ? "failed" : "now") : "next";
          return (
            <li key={s} aria-current={state === "now" ? "step" : undefined} className="flex min-h-[3.25rem] items-center gap-3 py-2.5">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  state === "done"
                    ? "bg-safe text-white"
                    : state === "now"
                      ? "animate-pulse bg-accent text-white"
                      : state === "failed"
                        ? "bg-red-600 text-white"
                        : "bg-ink/10 text-ink/40"
                }`}
              >
                {state === "done" ? "✓" : state === "failed" ? "!" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block break-words leading-snug ${state === "next" ? "text-ink/40" : "font-medium"}`}>{LABELS[s]}</span>
                {ENGINE[s] && (
                  <span className={`block text-xs ${state === "next" ? "text-ink/30" : "text-ink/55"}`}>
                    {ENGINE[s]}
                    {OPTIONAL_STEPS.has(s) && <span className="text-ink/40"> · optional</span>}
                  </span>
                )}
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
              <button type="button" onClick={onRetry} className="min-h-11 flex-1 rounded-xl bg-ink px-4 py-3 font-semibold text-white active:scale-[.99]">
                Try again
              </button>
            )}
            {onExample && (
              <button type="button" onClick={onExample} className="min-h-11 flex-1 rounded-xl border border-ink/20 px-4 py-3 font-semibold active:scale-[.99]">
                See the example plan
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
