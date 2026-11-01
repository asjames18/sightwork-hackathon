"use client";

import type { WorkPlan } from "@/lib/types";
import { useDoneSteps } from "@/lib/client/useDoneSteps";
import { useGotMaterials } from "@/lib/client/useGotMaterials";
import { alsoReadyLine, nextUp, nextUpHours, nextUpProgress } from "@/lib/client/nextUp";
import { stepMaterialsDescription, stepMaterialsLabel, stepMaterialsState } from "@/lib/client/stepMaterials";
import { stepWhoLabel } from "@/lib/client/stepText";
import { stepAnchor } from "@/lib/client/stepLinks";
import { StepSendButton } from "@/components/WorkSteps";

/**
 * "Next up": once any work step is ticked off, names the next step that is ready to start, who does it, about how
 * long, whether its materials are in hand, with a link to the step, a button to tick it off from here and one to
 * send just that step to whoever does it.
 * Nothing shows on an untouched plan. Live with the ticks (and other tabs). Hidden in print.
 */
export function NextUp({ plan }: { plan: WorkPlan }) {
  const { done, ready, update } = useDoneSteps(plan);
  const { got } = useGotMaterials(plan);
  if (!ready) return null;
  const n = nextUp(plan.workOrder, done);
  if (!n) return null;

  if (n.kind === "all") {
    return (
      <section
        aria-labelledby="next-up-heading"
        data-testid="next-up"
        data-kind="all"
        className="mt-4 rounded-2xl border-2 border-safe-dark/30 bg-white p-4 sm:p-5 print:hidden"
      >
        <h2 id="next-up-heading" className="text-lg font-bold text-safe-dark">
          Work order done
        </h2>
        <p className="mt-1 text-sm text-ink/80" aria-live="polite" data-testid="next-up-progress">
          {nextUpProgress(n)} Walk the space again to check each problem in person.
        </p>
      </section>
    );
  }

  const step = plan.workOrder.find((s) => s.order === n.order);
  if (!step) return null;
  const waitFor = n.waitingOn != null ? plan.workOrder.find((s) => s.order === n.waitingOn) : undefined;
  const who = stepWhoLabel(step.trade);
  const hours = nextUpHours(step.hours);
  const mats = stepMaterialsState(plan, step, got);
  const facts = [who, hours].filter(Boolean) as string[];
  const also = alsoReadyLine(n.alsoReady);

  return (
    <section
      aria-labelledby="next-up-heading"
      data-testid="next-up"
      data-kind="next"
      className="mt-4 rounded-2xl border-2 border-ink/10 bg-white p-4 sm:p-5 print:hidden"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="next-up-heading" className="text-lg font-bold">
          Next up
        </h2>
        <p className="text-sm font-semibold text-ink/70" aria-live="polite" data-testid="next-up-progress">
          {nextUpProgress(n)}
        </p>
      </div>
      <a
        href={`#${stepAnchor(step.order)}`}
        data-testid="next-up-step"
        className="mt-3 flex min-h-11 items-center gap-3 rounded-xl bg-ink/[0.04] px-3 py-2 text-sm font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs text-white" aria-hidden="true">
          {step.order}
        </span>
        <span className="min-w-0 break-words">
          <span className="sr-only">Step {step.order}: </span>
          {step.title}
        </span>
      </a>
      {(facts.length > 0 || mats) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink/80" data-testid="next-up-facts">
          {facts.length > 0 && <span>{facts.join(" · ")}</span>}
          {mats && (
            <span
              data-testid="next-up-materials"
              title={stepMaterialsDescription(mats)}
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mats.have >= mats.total ? "bg-safe-dark/10 text-safe-dark" : "bg-amber-100 text-amber-900"}`}
            >
              {stepMaterialsLabel(mats)}
              <span className="sr-only">. {stepMaterialsDescription(mats)}</span>
            </span>
          )}
        </p>
      )}
      {waitFor && (
        <p className="mt-2 text-sm font-semibold text-amber-900" data-testid="next-up-waiting">
          Waits on step {waitFor.order} ({waitFor.title}) to finish first.
        </p>
      )}
      {also && (
        <p className="mt-2 text-sm text-ink/70" data-testid="next-up-also">
          {also}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => update([...done, step.order])}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-ink/15 px-4 text-sm font-semibold hover:bg-ink/[0.04] focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50"
        >
          Mark step {step.order} done
        </button>
        <StepSendButton plan={plan} step={step} got={got} testId="next-up-send" spacing="" />
      </div>
    </section>
  );
}
