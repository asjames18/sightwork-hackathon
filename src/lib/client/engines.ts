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

/** Engine named on the Planning row when the run carries a place: the cost step prices it with web search on the Meta Model API. */
export const PRICING_ENGINE = "Muse Spark with web search";

/**
 * What does the work at each step, shown under the step label as an agent trace. When the run carries a
 * place ("City, ST"), the Planning row's real work is pricing materials and labor for it, which runs on
 * Muse Spark with web search whatever the plan provider is, so that row names it.
 */
export function stepEngines(provider: PlanProvider, region?: string | null): Record<ScreenStep, string> {
  const plan = provider === "baseten" ? "Muse Spark Open (open weights, on Baseten)" : "Muse Spark";
  return {
    uploading: "Key frames and audio, picked on your device",
    listening: "Muse Voice Transcribe",
    looking: "SAM 3.1",
    counting: "SAM 3.1",
    comparing: plan,
    planning: region?.trim() ? PRICING_ENGINE : plan,
    picturing: "Muse Image",
    reviewing: plan,
    done: "",
  };
}

/** Engines for this page load, read in the browser. */
export function currentStepEngines(region?: string | null): Record<ScreenStep, string> {
  const search = typeof window === "undefined" ? null : window.location.search;
  return stepEngines(pickPlanProvider(search, process.env.NEXT_PUBLIC_SIGHTWORK_PLAN_PROVIDER), region);
}

/** The "now" line for the Planning row. With a place, say what actually takes the time: live price lookups. */
export function planningNowLine(region?: string | null): string {
  const place = region?.trim();
  return place
    ? `Looking up material and labor prices for ${place}, then checking the plan. Live price lookups can take up to a minute.`
    : "Ranking the problems and putting the work steps in order.";
}
