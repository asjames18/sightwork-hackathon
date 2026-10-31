"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import { STEPS_CHANGED_EVENT, loadDoneSteps, planStepsKey, saveDoneSteps } from "./stepProgress";

type StepsPlan = Pick<WorkPlan, "spaceName" | "workOrder">;

/**
 * The ticked-off work steps for a plan, shared by every part of the plan screen: a tick in the work order
 * also shows on the Start here card, the problem cards and the shared text. Also follows other tabs.
 */
export function useDoneSteps(plan: StepsPlan | null): { done: number[]; ready: boolean; update: (next: number[]) => void } {
  const [done, setDone] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const key = plan ? planStepsKey(plan) : null;
  const planRef = useRef(plan);
  planRef.current = plan;

  useEffect(() => {
    const current = planRef.current;
    if (!key || !current) {
      setDone([]);
      setReady(true);
      return;
    }
    const reload = () => setDone(loadDoneSteps(planRef.current ?? current));
    reload();
    setReady(true);
    const onChange = (e: Event) => {
      const changed = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (!changed || changed === key) reload();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) reload();
    };
    window.addEventListener(STEPS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STEPS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  const update = useCallback((next: number[]) => {
    setDone(next);
    if (planRef.current) saveDoneSteps(planRef.current, next);
  }, []);

  return { done, ready, update };
}
