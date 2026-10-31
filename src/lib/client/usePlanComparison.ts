"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { WorkPlan } from "@/lib/types";
import {
  listRecentPlans,
  listRecentPlansOnServer,
  openRecentPlan,
  recentPlanId,
  recentWhen,
  subscribeRecentPlans,
} from "./recentPlans";
import { comparePlans, previousEntry, type PlanComparison } from "./planCompare";

export type LoadedComparison = { comparison: PlanComparison; when: string };

/**
 * The comparison of this plan with the previous saved walkthrough of the same space and place on this device,
 * or null while loading, when there's no earlier run, when its saved copy can't be read, or when `enabled` is
 * false (samples and example plans). Shared by the on-screen card and "Send to your team".
 */
export function usePlanComparison(plan: WorkPlan, enabled = true): LoadedComparison | null {
  const list = useSyncExternalStore(subscribeRecentPlans, listRecentPlans, listRecentPlansOnServer);
  const prev = enabled ? previousEntry(plan, list, recentPlanId(plan)) : null;
  const prevId = prev?.id ?? null;
  const [loaded, setLoaded] = useState<{ id: string; result: PlanComparison | null } | null>(null);

  useEffect(() => {
    if (!prevId) return;
    let live = true;
    void openRecentPlan(prevId).then((saved) => {
      if (live) setLoaded({ id: prevId, result: saved ? comparePlans(plan, saved.plan) : null });
    });
    return () => {
      live = false;
    };
  }, [prevId, plan]);

  if (!prev || !loaded || loaded.id !== prev.id || !loaded.result) return null;
  return { comparison: loaded.result, when: recentWhen(prev.savedAt) };
}
