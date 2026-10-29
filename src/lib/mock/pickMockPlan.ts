import type { WorkPlan } from "../types";
import { samplePlan } from "./samplePlan";
import { planNoCost, planNoMeta } from "./planNoMeta";
import { FEATURED_EXAMPLE } from "../examples";

export type MockPlanKind = "featured" | "full" | "nometa" | "nocost";

/**
 * `?mock=nometa` picks the plan-only example (no outlines, no after image). `?mock=nocost` is the
 * same plan on a run whose cost step failed. `?mock=full` is the old made-up full example. Anything else: the
 * featured real run (src/lib/examples), returned as the same object so the screen can label it.
 */
export function pickMockKind(search: string | null): MockPlanKind {
  const mock = search ? new URLSearchParams(search).get("mock") : null;
  return mock === "nometa" || mock === "nocost" || mock === "full" ? mock : "featured";
}

/** The example plan for this page load. Call it in the browser (after a user action), not during render. */
export function pickMockPlan(): WorkPlan {
  const search = typeof window === "undefined" ? null : window.location.search;
  const kind = pickMockKind(search);
  return kind === "nometa" ? planNoMeta : kind === "nocost" ? planNoCost : kind === "full" ? samplePlan : FEATURED_EXAMPLE.plan;
}
