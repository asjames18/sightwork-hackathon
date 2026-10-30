"use client";

import { useEffect, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import { loadDoneSteps, progressLine, saveDoneSteps } from "@/lib/client/stepProgress";

const range = (r: [number, number], unit = "") => (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`);

/** Ordered work steps as a checklist: tick steps off as the work happens; progress stays on this device for this plan. */
export function WorkSteps({ plan }: { plan: WorkPlan }) {
  const [done, setDone] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const total = plan.workOrder.length;

  useEffect(() => {
    setDone(loadDoneSteps(plan));
    setReady(true);
  }, [plan]);

  function toggle(order: number, checked: boolean) {
    const next = checked ? [...done, order] : done.filter((n) => n !== order);
    setDone(next);
    saveDoneSteps(plan, next);
  }

  function clearAll() {
    setDone([]);
    saveDoneSteps(plan, []);
  }

  const line = progressLine(done.length, total);
  const pct = total ? Math.round((done.length / total) * 100) : 0;

  return (
    <>
      <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 print:hidden">
        <p className="text-sm text-ink/75" aria-live="polite">
          {ready && line ? line : "Tick steps off as you go. Saved on this device."}
        </p>
        {done.length > 0 && (
          <button type="button" onClick={clearAll} className="btn-tertiary text-sm">
            Clear ticks
          </button>
        )}
      </div>
      {done.length > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink/10 print:hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-safe-dark transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ol className="rounded-2xl bg-white px-4 py-2 sm:px-5">
        {plan.workOrder.map((step, i) => {
          const last = i === total - 1;
          const isDone = done.includes(step.order);
          const volunteer = !!step.trade && /volunteer/i.test(step.trade);
          const chip = "inline-flex min-h-7 items-center rounded-full px-2.5 text-sm font-medium";
          const id = `step-${step.order}-done`;
          return (
            <li key={step.order} className="relative flex gap-3 py-3">
              {!last && (
                <span aria-hidden="true" className="absolute top-12 bottom-0 left-4 w-0.5 -translate-x-1/2 bg-ink/15" />
              )}
              <span
                aria-hidden="true"
                className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white tabular-nums ${
                  isDone ? "bg-safe-dark" : "bg-ink"
                }`}
              >
                {isDone ? (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                ) : (
                  step.order
                )}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className={`font-bold ${isDone ? "text-ink/70 line-through decoration-2" : ""}`}>
                  <span className="sr-only">Step {step.order}: </span>
                  {step.title}
                </p>
                <p className="text-sm text-ink/75">{step.detail}</p>
                {(step.trade || step.hours || step.dependsOn || (step.fixes && step.fixes.length > 0)) && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Step details">
                    {step.trade && (
                      <li
                        className={
                          volunteer ? `${chip} bg-safe/10 text-safe-dark` : `${chip} border border-ink/20 bg-ink/[0.04] text-ink`
                        }
                      >
                        {volunteer ? "Volunteer" : `Paid: ${step.trade}`}
                      </li>
                    )}
                    {step.hours && <li className={`${chip} bg-ink/[0.06] text-ink/80 tabular-nums`}>About {range(step.hours, " h")}</li>}
                    {step.dependsOn && <li className={`${chip} bg-ink/[0.06] text-ink/80`}>After step {step.dependsOn}</li>}
                    {step.fixes && step.fixes.length > 0 && (
                      <li className={`${chip} bg-ink/[0.06] text-ink/80`}>Fixes #{step.fixes.join(", #")}</li>
                    )}
                  </ul>
                )}
              </div>
              <label
                htmlFor={id}
                className="-mr-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 self-start rounded-xl px-2 text-sm font-medium text-ink/80 hover:bg-ink/[0.04] print:hidden"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={isDone}
                  onChange={(e) => toggle(step.order, e.target.checked)}
                  className="h-6 w-6 cursor-pointer accent-[var(--color-safe-dark)]"
                  aria-label={`Step ${step.order} done: ${step.title}`}
                />
                <span aria-hidden="true" className="hidden sm:inline">Done</span>
              </label>
            </li>
          );
        })}
      </ol>
    </>
  );
}
