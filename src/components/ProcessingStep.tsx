import { useEffect, useRef, useState } from "react";
import type { PlanStep } from "@/lib/types";
import { currentStepEngines, OPTIONAL_STEPS } from "@/lib/client/engines";
import { advanceClock, formatClock, formatStepTime, spokenClock, startClock, stepDuration, type StepClock } from "@/lib/client/elapsed";
import { canKeepScreenOn, keepScreenOn } from "@/lib/client/wakeLock";

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
  videoFile,
  failure,
  onRetry,
  onExample,
  engines,
  skipped,
}: {
  steps: PlanStep[];
  current: number;
  videoName: string;
  /** The picked video, used only to show its first frame as a small thumbnail next to the name. */
  videoFile?: File | null;
  failure?: StepFailure | null;
  onRetry?: () => void;
  onExample?: () => void;
  /** Engine named under each step. Defaults to this page's plan provider (see src/lib/client/engines.ts). */
  engines?: Record<PlanStep, string>;
  /** Optional steps the server skipped this run (e.g. Meta access off). Shown as skipped, not done. */
  skipped?: readonly PlanStep[];
}) {
  const ENGINE = engines ?? currentStepEngines();
  const thumb = useObjectUrl(videoFile);
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
  // One short polite announcement per step change. The whole section used to be the live region, so a
  // screen reader re-read every changed row (icons, state words, the "now" line) and, on failure, the
  // error twice (the alert card is its own live region).
  const nowStep = work[Math.min(current, work.length - 1)];
  const announce = failed || !nowStep ? "" : `Step ${position} of ${total}: ${LABELS[nowStep]}.`;
  const { clock, elapsedMs } = useStepClock(current, failed);
  // Keep the phone screen on while the plan runs: auto-lock can suspend the tab and drop the request.
  useEffect(() => (failed ? undefined : keepScreenOn()), [failed]);
  const [screenStaysOn, setScreenStaysOn] = useState(false);
  useEffect(() => setScreenStaysOn(canKeepScreenOn()), []);
  // The tab title follows the run, so a user who switched apps can see where it is at a glance.
  useEffect(() => {
    const before = document.title;
    return () => {
      document.title = before;
    };
  }, []);
  useEffect(() => {
    document.title = failed ? "Stopped · SightWork" : `Step ${position} of ${total} · SightWork`;
  }, [failed, position, total]);
  return (
    <section>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <h1 className="text-2xl font-extrabold sm:text-3xl">{failed ? "We couldn't finish your plan" : "Working on your plan"}</h1>
      <div className="mt-2 flex min-w-0 items-center gap-3">
        {thumb && (
          // First frame of the walkthrough (the #t fragment makes phones paint a frame without playing).
          <video
            aria-hidden="true"
            tabIndex={-1}
            src={`${thumb}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="h-12 w-16 shrink-0 rounded-lg bg-ink/10 object-cover"
          />
        )}
        <p className="min-w-0 truncate text-sm text-ink/70" title={videoName}>
          {videoName}
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">
            Step {position} of {total}
          </p>
          <p className="text-sm tabular-nums text-ink/70">
            <span aria-hidden="true">{formatClock(elapsedMs)}</span>
            <span className="sr-only">{spokenClock(elapsedMs)}</span> {failed ? "in total" : "elapsed"}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Plan progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={current}
          aria-valuetext={failed ? `Stopped at step ${position} of ${total}` : `Step ${position} of ${total}`}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${failed ? "bg-red-600" : "bg-accent"}`}
            style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
          />
        </div>
        {!failed && (
          <p className="mt-2 text-sm text-ink/65">
            Usually a few minutes. Keep this tab open{screenStaysOn ? "; we'll keep your screen on until it's done." : "."}
          </p>
        )}
      </div>

      <div className={`mt-5 ${failed ? "" : "lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-6"}`}>
      <ol className="divide-y divide-ink/5 rounded-2xl border border-ink/10 bg-white px-3 sm:px-4">
        {work.map((s, i) => {
          const passed = i < current ? (skipped?.includes(s) ? "skipped" : "done") : null;
          const state: keyof typeof STATE_TEXT = passed ?? (i === current ? (failed ? "failed" : "now") : "next");
          const took = state === "done" ? formatStepTime(stepDuration(clock, i) ?? 0) : null;
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
                    {took && <span className="tabular-nums"> · {took}</span>}
                  </span>
                )}
                {took && !(ENGINE[s] || state === "skipped") && (
                  <span className="block text-sm tabular-nums text-ink/65">{took}</span>
                )}
                {state !== "skipped" && <span className="sr-only">{STATE_TEXT[state]}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {!failed && <WhileYouWait />}
      </div>

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
                className="btn-primary flex-1 active:scale-[.99]"
              >
                Try again
              </button>
            )}
            {onExample && (
              <button
                type="button"
                onClick={onExample}
                className="btn-secondary flex-1 active:scale-[.99]"
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

/** What the finished plan holds, beside the step list on desktop so the screen isn't half empty. Only parts
 * every run produces are listed (no cost or after picture, which are optional steps). Phones skip it. */
const PLAN_PARTS = [
  "Problems ranked by priority, including ones you didn't mention",
  "Rough counts of what's in the room",
  "Work steps in order, volunteer or paid trade",
  "A materials list",
] as const;

function WhileYouWait() {
  return (
    <aside aria-labelledby="while-you-wait" className="hidden rounded-2xl bg-ink/[.04] p-5 lg:block">
      <h2 id="while-you-wait" className="text-base font-bold">
        While you wait
      </h2>
      <p className="mt-1 text-sm text-ink/70">Your plan will have:</p>
      <ul className="mt-3 space-y-2.5 text-sm text-ink/80">
        {PLAN_PARTS.map((t) => (
          <li key={t} className="flex gap-2">
            <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-dark" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink/70">When it's ready, your plan opens here on its own.</p>
    </aside>
  );
}

/**
 * Step times for this run plus a once-a-second running total. A retry (the step index going back, or
 * the run leaving the failed state) starts a fresh clock. The total freezes when a run stops.
 */
function useStepClock(current: number, failed: boolean): { clock: StepClock; elapsedMs: number } {
  const [clock, setClock] = useState<StepClock>(() => startClock(Date.now(), current));
  const [now, setNow] = useState(() => Date.now());
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const wasFailed = useRef(failed);
  useEffect(() => {
    const restarted = wasFailed.current && !failed;
    wasFailed.current = failed;
    const t = Date.now();
    setClock((c) => advanceClock(c, current, t, restarted));
    setStoppedAt(failed ? t : null);
    setNow(t);
  }, [current, failed]);
  useEffect(() => {
    if (failed) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [failed]);
  return { clock, elapsedMs: (stoppedAt ?? now) - clock.start };
}

/** A blob URL for the picked file, revoked when the file changes or the screen goes away. */
function useObjectUrl(file?: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [file]);
  return file ? url : null;
}
