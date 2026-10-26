import type { PlanStep } from "@/lib/types";

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
}: {
  steps: PlanStep[];
  current: number;
  videoName: string;
  failure?: StepFailure | null;
  onRetry?: () => void;
  onExample?: () => void;
}) {
  const failed = Boolean(failure);
  return (
    <section aria-live="polite">
      <h1 className="text-2xl font-extrabold">{failed ? "We couldn't finish your plan" : "Working on your plan"}</h1>
      <p className="mt-1 truncate text-sm text-ink/60">{videoName}</p>
      <ol className="mt-6 space-y-3">
        {steps.map((s, i) => {
          const state = i < current ? "done" : i === current ? (failed ? "failed" : "now") : "next";
          return (
            <li key={s} className="flex items-center gap-3">
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
              <span className={state === "next" ? "text-ink/40" : "font-medium"}>{LABELS[s]}</span>
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
              <button type="button" onClick={onRetry} className="flex-1 rounded-xl bg-ink px-4 py-3 font-semibold text-white active:scale-[.99]">
                Try again
              </button>
            )}
            {onExample && (
              <button type="button" onClick={onExample} className="flex-1 rounded-xl border border-ink/20 px-4 py-3 font-semibold active:scale-[.99]">
                See the example plan
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
