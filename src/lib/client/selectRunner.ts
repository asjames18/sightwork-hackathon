import { mockPlanJob, type PlanJobRunner } from "./planJob";
import { createApiPlanJob } from "./apiPlanJob";
import { createBuildPlanRequest, requestBudgetBytes } from "./buildPlanRequest";

export type RunnerKind = "mock" | "api";

/**
 * Which runner the flow uses. The mock stays the default until /api/plan is live.
 * - Build-time default: NEXT_PUBLIC_SIGHTWORK_RUNNER=api (anything else means mock).
 * - Preview override: `?runner=api` or `?runner=mock` in the page URL wins over the env value.
 */
export function pickRunnerKind(search: string | null, envValue: string | undefined): RunnerKind {
  const fromQuery = search ? new URLSearchParams(search).get("runner") : null;
  if (fromQuery === "api" || fromQuery === "mock") return fromQuery;
  return envValue === "api" ? "api" : "mock";
}

/**
 * Demo defaults sent with each request. Region is left out until Antonio picks one, so no cost range is asked for.
 * The request budget comes from NEXT_PUBLIC_SIGHTWORK_MAX_REQUEST_BYTES (unset keeps 9 MB).
 */
const apiPlanJob = createApiPlanJob(
  createBuildPlanRequest({
    spaceType: "room",
    maxRequestBytes: requestBudgetBytes(process.env.NEXT_PUBLIC_SIGHTWORK_MAX_REQUEST_BYTES),
  }),
);

/**
 * The one runner the UI uses. It decides per run (in the browser), so the server render and the
 * first client render match and the query override works without a rebuild.
 */
export const selectedPlanJob: PlanJobRunner = (input) => {
  const search = typeof window === "undefined" ? null : window.location.search;
  const kind = pickRunnerKind(search, process.env.NEXT_PUBLIC_SIGHTWORK_RUNNER);
  return (kind === "api" ? apiPlanJob : mockPlanJob)(input);
};
