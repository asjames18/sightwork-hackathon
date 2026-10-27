import type { WorkPlan } from "../types";
import { samplePlan } from "./samplePlan";
import { planNoMeta } from "./planNoMeta";

export type MockPlanKind = "full" | "nometa";

/** `?mock=nometa` picks the plan-only example (no outlines, no after image). Anything else: the full example. */
export function pickMockKind(search: string | null): MockPlanKind {
  return search && new URLSearchParams(search).get("mock") === "nometa" ? "nometa" : "full";
}

/** The example plan for this page load. Call it in the browser (after a user action), not during render. */
export function pickMockPlan(): WorkPlan {
  const search = typeof window === "undefined" ? null : window.location.search;
  return pickMockKind(search) === "nometa" ? planNoMeta : samplePlan;
}
