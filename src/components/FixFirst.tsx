import type { Issue, WorkStep } from "@/lib/types";
import type { CostShare } from "@/lib/costShares";
import { fixFirst, fixFirstCostLabel } from "@/lib/client/fixFirst";
import { problemAnchor, stepAnchor } from "@/lib/client/stepLinks";

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Start here": when some problems are Fix now, names the few steps that take care of them (plus any
 * step they wait on), with hours, trades and their share of the estimate. Shows nothing otherwise.
 */
export function FixFirst({
  issues,
  workOrder,
  stepCosts,
  issueCosts,
}: {
  issues: Issue[];
  workOrder: WorkStep[];
  stepCosts: Map<number, CostShare> | null;
  issueCosts: Map<number, CostShare> | null;
}) {
  const f = fixFirst(issues, workOrder, { steps: stepCosts, issues: issueCosts });
  if (!f) return null;
  const byOrder = new Map(workOrder.map((s) => [s.order, s]));
  const n = f.ranks.length;
  const rest = f.totalSteps - f.steps.length;
  const facts = [
    f.hours && `${sentence(f.hours)} of work`,
    f.trades.length > 0 && f.trades.join(", "),
    f.cost && `${sentence(fixFirstCostLabel(f.cost))} of the estimate`,
  ].filter(Boolean) as string[];
  const waitsOn = (order: number) =>
    workOrder
      .filter((s) => s.dependsOn === order && f.steps.includes(s.order))
      .map((s) => s.order)
      .sort((a, b) => a - b);

  return (
    <section
      aria-labelledby="fix-first-heading"
      data-testid="fix-first"
      className="mt-6 rounded-2xl border-2 border-red-700/25 bg-white p-4 sm:p-5 print:break-inside-avoid"
    >
      <h2 id="fix-first-heading" className="text-lg font-bold">
        Start here
      </h2>
      <p className="mt-1 text-sm text-ink/80" data-testid="fix-first-lead">
        {n === 1 ? "1 problem is" : `${n} problems are`} <span className="font-semibold text-red-800">Fix now</span>.{" "}
        {f.steps.length === 1 ? "This step takes" : `These ${f.steps.length} steps take`} care of{" "}
        {n === 1 ? "it" : f.unplanned.length ? "most of them" : "them"}:
      </p>
      <ol className="mt-3 space-y-2">
        {f.steps.map((o) => {
          const step = byOrder.get(o);
          const before = f.prerequisites.includes(o) ? waitsOn(o) : [];
          return (
            <li key={o} className="text-sm">
              <a
                href={`#${stepAnchor(o)}`}
                className="flex min-h-11 items-center gap-3 rounded-xl bg-ink/[0.04] px-3 py-2 font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs text-white" aria-hidden="true">
                  {o}
                </span>
                <span className="min-w-0 break-words">
                  <span className="sr-only">Step {o}: </span>
                  {step?.title ?? `Step ${o}`}
                  {before.length > 0 && (
                    <span className="block text-xs font-normal text-ink/70">
                      Needed before step{before.length > 1 ? "s" : ""} {before.join(" and ")}
                    </span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {facts.length > 0 && (
        <p className="mt-3 text-sm text-ink/80" data-testid="fix-first-facts">
          {facts.join(" · ")}
        </p>
      )}
      {f.unplanned.length > 0 && (
        <p className="mt-2 text-sm text-red-800" data-testid="fix-first-unplanned">
          No step covers{" "}
          {f.unplanned.map((r, i) => (
            <span key={r}>
              {i > 0 && (i === f.unplanned.length - 1 ? " and " : ", ")}
              <a href={`#${problemAnchor(r)}`} className="font-semibold underline underline-offset-2">
                problem #{r}
              </a>
            </span>
          ))}{" "}
          yet, so plan {f.unplanned.length === 1 ? "it" : "them"} by hand.
        </p>
      )}
      {rest > 0 && (
        <p className="mt-2 text-xs text-ink/65">
          The other {rest === 1 ? "step" : `${rest} steps`} can follow once these are done.
        </p>
      )}
    </section>
  );
}
