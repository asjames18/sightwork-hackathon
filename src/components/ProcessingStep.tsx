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

export function ProcessingStep({ steps, current, videoName }: { steps: PlanStep[]; current: number; videoName: string }) {
  return (
    <section aria-live="polite">
      <h1 className="text-2xl font-extrabold">Working on your plan</h1>
      <p className="mt-1 truncate text-sm text-ink/60">{videoName}</p>
      <ol className="mt-6 space-y-3">
        {steps.map((s, i) => {
          const state = i < current ? "done" : i === current ? "now" : "next";
          return (
            <li key={s} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  state === "done" ? "bg-safe text-white" : state === "now" ? "animate-pulse bg-accent text-white" : "bg-ink/10 text-ink/40"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={state === "next" ? "text-ink/40" : "font-medium"}>{LABELS[s]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
