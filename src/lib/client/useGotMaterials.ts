"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import { MATERIALS_CHANGED_EVENT, loadGotMaterials, planMaterialsKey } from "./materialsList";

type MaterialsPlan = Pick<WorkPlan, "spaceName" | "materials">;

/**
 * Read-only view of the shopping list ticks for a plan, so other parts of the plan screen (the work steps) follow
 * the materials list live, and other tabs too. Empty until mounted, since the server render has no storage.
 */
export function useGotMaterials(plan: MaterialsPlan | null): { got: number[]; ready: boolean } {
  const [got, setGot] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const key = plan && plan.materials.length > 0 ? planMaterialsKey(plan) : null;
  const planRef = useRef(plan);
  planRef.current = plan;

  useEffect(() => {
    const current = planRef.current;
    if (!key || !current) {
      setGot([]);
      setReady(true);
      return;
    }
    const reload = () => setGot(loadGotMaterials(planRef.current ?? current));
    reload();
    setReady(true);
    const onChange = (e: Event) => {
      const changed = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (!changed || changed === key) reload();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) reload();
    };
    window.addEventListener(MATERIALS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(MATERIALS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  return { got, ready };
}
