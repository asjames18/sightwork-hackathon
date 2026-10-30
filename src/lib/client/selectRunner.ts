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
 * Which runner a video the user brought (recorded here or chosen) goes to. Unlike pickRunnerKind, an
 * unset NEXT_PUBLIC_SIGHTWORK_RUNNER (the public site) means a real run: someone who films their own
 * space must never be handed the example plan as if it came from their video. The example-plan preview
 * runs only when it is asked for on purpose:
 * - `?runner=mock` (or `?runner=api` to force a real run), which wins over everything else;
 * - the preview-only switches `?fail=<step>` and `?mock=nometa`;
 * - a build with NEXT_PUBLIC_SIGHTWORK_RUNNER=mock set explicitly (the local e2e build).
 * A real run still needs the tester code (see needsTesterCode), so nothing is spent without it.
 */
export function ownVideoRunnerKind(search: string | null, envValue: string | undefined): RunnerKind {
  const q = search ? new URLSearchParams(search) : null;
  const fromQuery = q?.get("runner");
  if (fromQuery === "api" || fromQuery === "mock") return fromQuery;
  if (q && (q.has("fail") || q.has("mock"))) return "mock";
  return envValue?.trim().toLowerCase() === "mock" ? "mock" : "api";
}

/** A real run can't start without a saved tester code: ask for it first, keeping the video. */
export function needsTesterCode(kind: RunnerKind, savedCode: string): boolean {
  return kind === "api" && !savedCode.trim();
}

/** The runner for a kind. Stable references, so a run only restarts when the video or run number changes. */
export function planJobFor(kind: RunnerKind): PlanJobRunner {
  return kind === "api" ? apiPlanJob : mockPlanJob;
}

/** The runner kind for a video the user brought, read in the browser for this page load. */
export function currentOwnVideoRunnerKind(): RunnerKind {
  const search = typeof window === "undefined" ? null : window.location.search;
  return ownVideoRunnerKind(search, process.env.NEXT_PUBLIC_SIGHTWORK_RUNNER);
}
