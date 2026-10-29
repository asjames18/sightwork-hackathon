import { PLAN_STEPS, type PlanJobStatus, type PlanRequest, type PlanStep } from "@/lib/types";
import type { PlanJobRunner } from "./planJob";
import { loadTestCode, TEST_CODE_HEADER } from "./testCode";

/**
 * Turns the picked video into the request body (frames + narration).
 * Runs in the browser; kept separate so the runner stays a thin transport.
 */
export type BuildPlanRequest = (file: File, signal: AbortSignal) => Promise<PlanRequest>;

type RunStep = Exclude<PlanStep, "done">;

const GENERIC_FAIL = "Something went wrong while making the plan. Try again, or open the example plan.";
const CONNECTION_FAIL = "The connection dropped before the plan finished. Try again.";

function isRunStep(v: unknown): v is RunStep {
  return typeof v === "string" && (PLAN_STEPS as string[]).includes(v);
}

/**
 * Checks one streamed line against PlanJobStatus. Returns null for anything that
 * doesn't fit, so a bad line is skipped instead of breaking the screen.
 */
export function parseStatusLine(line: string): PlanJobStatus | null {
  const text = line.trim();
  if (!text) return null;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.state === "running" && isRunStep(o.step)) {
    const skipped = Array.isArray(o.skipped) ? o.skipped.filter(isRunStep) : [];
    return skipped.length ? { state: "running", step: o.step, skipped } : { state: "running", step: o.step };
  }
  if (o.state === "failed" && isRunStep(o.step))
    return { state: "failed", step: o.step, message: typeof o.message === "string" && o.message ? o.message : GENERIC_FAIL };
  if (o.state === "done" && o.plan && typeof o.plan === "object")
    return { state: "done", plan: o.plan as Extract<PlanJobStatus, { state: "done" }>["plan"] };
  return null;
}

/**
 * Screen text for a non-OK /api/plan response, keyed by status. The server's own
 * {error} text is written for developers, so it goes to the console, not the screen.
 */
export function messageForStatus(status: number): string {
  if (status === 401) return "Real runs need a tester code. Enter it on the start screen, or open the example plan.";
  if (status === 413) return "That video is too large to send. Try a shorter walkthrough.";
  if (status === 400) return "The video's frames didn't come through right. Try again, or open the example plan.";
  if (status === 429) return "Too many plans are running right now. Wait a minute and try again.";
  if (status === 504) return "The plan took too long to finish. Try a shorter walkthrough, or open the example plan.";
  return GENERIC_FAIL;
}

/** Reads a JSON {error} (or short plain text) from a non-OK response and logs it. Never throws. */
async function logServerError(res: Response): Promise<void> {
  try {
    const text = (await res.text()).slice(0, 500);
    let detail = text;
    try {
      const v: unknown = JSON.parse(text);
      if (v && typeof v === "object" && typeof (v as { error?: unknown }).error === "string")
        detail = (v as { error: string }).error;
    } catch {
      /* plain text body */
    }
    console.warn(`plan request failed: HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
  } catch {
    /* body unreadable; the status is enough */
  }
}

/**
 * Real runner for POST /api/plan. The server streams newline-delimited JSON, one
 * PlanJobStatus per line; the last line is done or failed. Aborting the signal
 * cancels the request, and the server stops its work on disconnect.
 */
export function createApiPlanJob(buildRequest: BuildPlanRequest, endpoint = "/api/plan"): PlanJobRunner {
  return async ({ file, onStatus, signal }) => {
    let lastStep: RunStep = "uploading";
    const report = (s: PlanJobStatus) => {
      if (signal.aborted) return;
      if (s.state !== "done") lastStep = s.step;
      onStatus(s);
    };
    const fail = (message: string) => report({ state: "failed", step: lastStep, message });

    report({ state: "running", step: "uploading" });

    let body: PlanRequest;
    try {
      body = await buildRequest(file, signal);
    } catch {
      if (!signal.aborted) fail("We couldn't read that video. Try a different file, or open the example plan.");
      return;
    }
    if (signal.aborted) return;

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", [TEST_CODE_HEADER]: loadTestCode() },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      if (!signal.aborted) fail(CONNECTION_FAIL);
      return;
    }
    if (!res.ok || !res.body) {
      if (!res.ok) await logServerError(res);
      fail(res.ok ? GENERIC_FAIL : messageForStatus(res.status));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let finished = false;
    const handle = (line: string) => {
      const s = parseStatusLine(line);
      if (!s || finished) return;
      if (s.state !== "running") finished = true;
      report(s);
    };

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          handle(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
        }
        if (finished) break;
      }
      buf += decoder.decode();
      if (!finished && buf) handle(buf);
    } catch {
      if (!signal.aborted && !finished) fail(CONNECTION_FAIL);
      return;
    } finally {
      reader.cancel().catch(() => {});
    }

    if (!finished && !signal.aborted) fail(CONNECTION_FAIL);
  };
}
