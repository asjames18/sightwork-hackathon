import type { PlanProvider, RunStep } from "@/lib/types";

/** Every step the processing screen can name, plus the end state. */
export type ScreenStep = RunStep | "done";

/**
 * Which plan engine the processing screen names. Build-time default comes from
 * NEXT_PUBLIC_SIGHTWORK_PLAN_PROVIDER ("baseten" or "meta"); `?plan=baseten|meta` overrides it in a preview.
 * Unset or blank means "baseten", matching the server's PLAN_PROVIDER default.
 * Labels only: the server decides what actually runs.
 */
export function pickPlanProvider(search: string | null, envValue: string | undefined): PlanProvider {
  const q = search ? new URLSearchParams(search).get("plan") : null;
  if (q === "baseten" || q === "meta") return q;
  return envValue?.trim().toLowerCase() === "meta" ? "meta" : "baseten";
}

/** Steps that need Meta model access and may be skipped; the plan still finishes without them. */
export const OPTIONAL_STEPS: ReadonlySet<ScreenStep> = new Set<ScreenStep>(["looking", "counting", "picturing"]);

/** Steps that only check the plan and can never stop a run. */
export const REVIEW_ONLY_STEPS: ReadonlySet<ScreenStep> = new Set<ScreenStep>(["reviewing"]);

/** What does the work at each step, shown under the step label as an agent trace. */
export function stepEngines(provider: PlanProvider): Record<ScreenStep, string> {
  const plan = provider === "baseten" ? "Muse Spark Open (open weights, on Baseten)" : "Muse Spark";
  return {
    uploading: "Key frames and audio, picked on your device",
    listening: "Muse Voice Transcribe",
    looking: "SAM 3.1",
    counting: "SAM 3.1",
    comparing: plan,
    planning: plan,
    picturing: "Muse Image",
    reviewing: plan,
    done: "",
  };
}

/** Engines for this page load, read in the browser. */
export function currentStepEngines(): Record<ScreenStep, string> {
  const search = typeof window === "undefined" ? null : window.location.search;
  return stepEngines(pickPlanProvider(search, process.env.NEXT_PUBLIC_SIGHTWORK_PLAN_PROVIDER));
}
