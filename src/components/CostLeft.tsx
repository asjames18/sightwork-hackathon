"use client";

import type { WorkPlan } from "@/lib/types";
import type { CostShare } from "@/lib/costShares";
import { useDoneSteps } from "@/lib/client/useDoneSteps";
import { costLeft, costLeftLine } from "@/lib/client/costLeft";

/** On the cost card: how much of the range is still ahead once some steps are ticked off (screen only). */
export function CostLeft({ plan, stepCosts }: { plan: Pick<WorkPlan, "spaceName" | "workOrder">; stepCosts: Map<number, CostShare> | null }) {
  const { done, ready } = useDoneSteps(stepCosts ? plan : null);
  // Ticks load after mount, so the server render never shows a line.
  const line = ready && stepCosts ? costLeftLine(costLeft(plan.workOrder, stepCosts, done)) : "";
  return (
    <p aria-live="polite" data-testid="cost-left" className={line ? "mt-2 text-sm font-semibold text-ink tabular-nums print:hidden" : "sr-only"}>
      {line}
    </p>
  );
}
