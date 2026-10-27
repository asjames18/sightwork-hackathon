import type { WorkPlan } from "../types";
import { samplePlan } from "./samplePlan";
import { planNoCost, planNoMeta } from "./planNoMeta";

export type MockPlanKind = "full" | "nometa" | "nocost";

/**
 * `?mock=nometa` picks the plan-only example (no outlines, no after image). `?mock=nocost` is the
 * same plan on a run whose cost step failed. Anything else: the full example.
 */
export function pickMockKind(search: string | null): MockPlanKind {
  const mock = search ? new URLSearchParams(search).get("mock") : null;
  return mock === "nometa" || mock === "nocost" ? mock : "full";
}

/** The example plan for this page load. Call it in the browser (after a user action), not during render. */
export function pickMockPlan(): WorkPlan {
  const search = typeof window === "undefined" ? null : window.location.search;
  const kind = pickMockKind(search);
  return kind === "nometa" ? planNoMeta : kind === "nocost" ? planNoCost : samplePlan;
}
