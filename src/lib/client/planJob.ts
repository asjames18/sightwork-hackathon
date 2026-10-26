import { PLAN_STEPS, type PlanJobStatus, type PlanStep } from "@/lib/types";
import { samplePlan } from "@/lib/mock/samplePlan";

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

/** Mock runner: walks the step labels on a timer and ends on the EXAMPLE plan. No network calls. */
export const mockPlanJob: PlanJobRunner = async ({ onStatus, signal }) => {
  const failAt = mockFailStep();
  for (const step of PLAN_STEPS) {
    if (signal.aborted) return;
    onStatus({ state: "running", step });
    if (!(await wait(STEP_MS, signal))) return;
    if (step === failAt) {
      onStatus({
        state: "failed",
        step,
        message: "Preview failure for testing. Nothing was sent anywhere. Try again, or open the example plan.",
      });
      return;
    }
  }
  if (!signal.aborted) onStatus({ state: "done", plan: samplePlan });
};
