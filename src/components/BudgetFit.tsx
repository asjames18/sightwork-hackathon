"use client";

import { useEffect, useId, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import type { CostShare } from "@/lib/costShares";
import { useDoneSteps } from "@/lib/client/useDoneSteps";
import { planStepsKey } from "@/lib/client/stepProgress";
import { budgetFit, budgetFitLine, parseBudget } from "@/lib/client/budgetFit";

/**
 * On the cost card: type what there is to spend and see how many steps, in work order, it covers and what is
 * still to find. The number is kept on this device for this plan. Screen only; hidden in print.
 */
export function BudgetFit({ plan, stepCosts }: { plan: Pick<WorkPlan, "spaceName" | "workOrder">; stepCosts: Map<number, CostShare> | null }) {
  const id = useId();
  const { done, ready } = useDoneSteps(stepCosts ? plan : null);
  const [text, setText] = useState("");
  const storeKey = `${planStepsKey(plan)}:budget`;

  useEffect(() => {
    try {
      setText(window.localStorage.getItem(storeKey) ?? "");
    } catch {
      setText("");
    }
  }, [storeKey]);

  if (!stepCosts || stepCosts.size === 0) return null;

  function onChange(value: string) {
    const v = value.slice(0, 12);
    setText(v);
    try {
      if (v.trim()) window.localStorage.setItem(storeKey, v);
      else window.localStorage.removeItem(storeKey);
    } catch {
      /* private mode: the number just isn't kept */
    }
  }

  const budget = parseBudget(text);
  const line = ready ? budgetFitLine(budgetFit(plan.workOrder, stepCosts, done, budget)) : "";
  const bad = text.trim() !== "" && budget === null;

  return (
    <div className="mt-3 border-t border-ink/10 pt-3 print:hidden" data-testid="budget-fit">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        Got a budget? See what it covers
      </label>
      <div className="mt-1 flex items-center gap-2">
        <span aria-hidden="true" className="text-base font-semibold text-ink/70">
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="1,500"
          aria-describedby={`${id}-out`}
          aria-invalid={bad || undefined}
          data-testid="budget-input"
          className="min-h-11 w-40 rounded-md border border-ink/30 bg-white px-3 text-base text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
        />
      </div>
      <p id={`${id}-out`} aria-live="polite" data-testid="budget-fit-line" className={line || bad ? "mt-2 text-sm text-ink tabular-nums" : "sr-only"}>
        {bad ? "Type the amount in dollars, like 1500." : line}
      </p>
    </div>
  );
}
