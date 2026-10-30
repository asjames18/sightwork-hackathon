import { PLAN_STEPS, RUN_STEPS, type PlanJobStatus, type PlanStep } from "@/lib/types";
import { pickMockPlan } from "@/lib/mock/pickMockPlan";
import { withPrecomputedReview } from "@/lib/review";
import { stepChecksForPlan } from "@/lib/stepChecks";

/** What the UI hands a runner: the picked video, plus where to report progress. */
export interface PlanJobInput {
  file: File;
  onStatus: (status: PlanJobStatus) => void;
  signal: AbortSignal;
}

/**
 * Runs one plan job and reports every status change through onStatus.
 * The UI only knows this interface, so the mock runner and the real API runner swap in one place.
 */
export type PlanJobRunner = (input: PlanJobInput) => Promise<void>;

const STEP_MS = 650;

/**
 * Preview-only: `?fail=<step>` (for example `?fail=looking`) stops the mock run at that step,
 * so the failure screen can be checked without any API calls.
 */
function mockFailStep(): PlanStep | null {
  if (typeof window === "undefined") return null;
  const step = new URLSearchParams(window.location.search).get("fail") as PlanStep | null;
  return step && (PLAN_STEPS as PlanStep[]).includes(step) ? step : null;
}

function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const id = setTimeout(() => resolve(!signal.aborted), ms);
    signal.addEventListener("abort", () => { clearTimeout(id); resolve(false); }, { once: true });
  });
}

/** Mock runner: walks the step labels on a timer and ends on the EXAMPLE plan (`?mock=nometa` for the plan-only one). No network calls. */
export const mockPlanJob: PlanJobRunner = async ({ onStatus, signal }) => {
  const failAt = mockFailStep();
  // `?mock=nometa` also previews the processing screen with Meta's optional steps skipped,
  // on the real route's timing: looking and counting show active, then flip to skipped on the
  // comparing line; picturing's skip only shows on the finished plan (meta.skipped.afterImage).
  const noMeta = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mock") === "nometa";
  const skipped: Exclude<PlanStep, "done">[] = [];
  // The plan the preview ends on, with its precomputed proof check, so the check notes describe that plan.
  const plan = withPrecomputedReview(pickMockPlan());
  const checks = stepChecksForPlan(plan);
  for (const step of RUN_STEPS) {
    if (signal.aborted) return;
    const base = skipped.length ? { state: "running" as const, step, skipped: [...skipped] } : { state: "running" as const, step };
    onStatus(base);
    if (!(await wait(STEP_MS, signal))) return;
    if (step === failAt) {
      onStatus({
        state: "failed",
        step,
        message: "Preview failure for testing. Nothing was sent anywhere. Try again, or open the example plan.",
      });
      return;
    }
    if (noMeta && step === "counting") skipped.push("looking", "counting");
    const check = checks[step];
    if (check && !skipped.includes(step as Exclude<PlanStep, "done">)) onStatus({ ...base, check });
  }
  if (!signal.aborted) onStatus({ state: "done", plan });
};
