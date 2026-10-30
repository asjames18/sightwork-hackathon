import { RUN_STEPS, type PlanJobStatus, type PlanRequest, type RunStep, type WorkPlan } from "@/lib/types";
import { parseReview } from "@/lib/review";
import { parseStepCheck } from "@/lib/stepChecks";
import type { PlanJobRunner } from "./planJob";
import { loadTestCode, TEST_CODE_HEADER } from "./testCode";

/**
 * Turns the picked video into the request body (frames + narration).
 * Runs in the browser; kept separate so the runner stays a thin transport.
 */
export type BuildPlanRequest = (file: File, signal: AbortSignal) => Promise<PlanRequest>;

const GENERIC_FAIL = "Something went wrong while making the plan. Try again, or open the example plan.";
const CONNECTION_FAIL = "The connection dropped before the plan finished. Try again.";

function isRunStep(v: unknown): v is RunStep {
  return typeof v === "string" && (RUN_STEPS as string[]).includes(v);
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
    // "reviewing" is a run step but never an optional skip.
    const skipped = Array.isArray(o.skipped) ? o.skipped.filter((s): s is Exclude<RunStep, "reviewing"> => isRunStep(s) && s !== "reviewing") : [];
    const check = parseStepCheck(o.check);
    return { state: "running", step: o.step, ...(skipped.length ? { skipped } : {}), ...(check ? { check } : {}) };
  }
  if (o.state === "failed" && isRunStep(o.step))
    return { state: "failed", step: o.step, message: typeof o.message === "string" && o.message ? o.message : GENERIC_FAIL };
  if (o.state === "done" && o.plan && typeof o.plan === "object") {
    const plan = o.plan as WorkPlan;
    // The review is advisory: a malformed one is dropped (the plan shows without it), never trusted as-is.
    if ("review" in plan) {
      const review = Array.isArray(plan.issues) ? parseReview(plan.review, plan.issues) : undefined;
      const { review: _r, ...rest } = plan;
      void _r;
      return { state: "done", plan: review ? { ...rest, review } : rest };
    }
    return { state: "done", plan };
  }
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
async function logServerError(res: Response, what = "plan"): Promise<void> {
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
    console.warn(`${what} request failed: HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
  } catch {
    /* body unreadable; the status is enough */
  }
}

/** Shape POST /api/transcribe answers with (TranscribeOutput). */
type TranscribeAnswer = { transcript: string | null; transcriptTurns: NonNullable<PlanRequest["transcriptTurns"]> };

function isTurn(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return typeof t.startSec === "number" && Number.isFinite(t.startSec) && typeof t.text === "string";
}

/** Checks a /api/transcribe body. A blank transcript counts as no narration (null), which /api/plan accepts. */
export function parseTranscribeAnswer(v: unknown): TranscribeAnswer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.transcript !== null && typeof o.transcript !== "string") return null;
  const turns = o.transcriptTurns === undefined ? [] : o.transcriptTurns;
  if (!Array.isArray(turns) || !turns.every(isTurn)) return null;
  const transcript = typeof o.transcript === "string" && o.transcript.trim() ? o.transcript : null;
  return { transcript, transcriptTurns: transcript ? (turns as TranscribeAnswer["transcriptTurns"]) : [] };
}

/**
 * Option (b) for the 4.5 MB body cap: when the request carries narration, POST it alone to
 * /api/transcribe first and send the plan request with the transcript instead of the WAV.
 * Returns the request to send, or "unauthorized" on 401. Any other failure keeps the original
 * WAV-carrying request, so narration is never silently dropped (same behavior as before the split).
 */
async function splitNarration(
  body: PlanRequest,
  endpoint: string,
  code: string,
  signal: AbortSignal,
): Promise<PlanRequest | "unauthorized"> {
  if (!body.audioWavBase64 || body.transcript !== undefined) return body;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", [TEST_CODE_HEADER]: code },
      body: JSON.stringify(body.spaceType ? { audioWavBase64: body.audioWavBase64, spaceType: body.spaceType } : { audioWavBase64: body.audioWavBase64 }),
      signal,
    });
    if (res.status === 401) return "unauthorized";
    if (!res.ok) {
      await logServerError(res, "transcribe");
      return body;
    }
    const answer = parseTranscribeAnswer(await res.json());
    if (!answer) return body;
    const { audioWavBase64: _wav, ...rest } = body;
    void _wav;
    return { ...rest, transcript: answer.transcript, transcriptTurns: answer.transcriptTurns };
  } catch {
    return body;
  }
}

/**
 * Real runner for POST /api/plan. The server streams newline-delimited JSON, one
 * PlanJobStatus per line; the last line is done or failed. Aborting the signal
 * cancels the request, and the server stops its work on disconnect.
 * With narration, POST /api/transcribe runs first (pass null to skip that split).
 */
export function createApiPlanJob(
  buildRequest: BuildPlanRequest,
  endpoint = "/api/plan",
  transcribeEndpoint: string | null = "/api/transcribe",
): PlanJobRunner {
  return async ({ file, onStatus, signal }) => {
    let lastStep: RunStep = "uploading";
    const report = (s: PlanJobStatus) => {
      if (signal.aborted) return;
      if (s.state !== "done") lastStep = s.step;
      onStatus(s);
    };
    const fail = (message: string) => report({ state: "failed", step: lastStep, message });

    report({ state: "running", step: "uploading" });

    // The server answers 401 to any run without a tester code (src/proxy.ts), so don't spend the time
    // reading frames and audio and uploading megabytes just to hear that.
    if (!loadTestCode()) {
      fail(messageForStatus(401));
      return;
    }

    let body: PlanRequest;
    try {
      body = await buildRequest(file, signal);
    } catch {
      if (!signal.aborted) fail("We couldn't read that video. Try a different file, or open the example plan.");
      return;
    }
    if (signal.aborted) return;

    if (transcribeEndpoint) {
      const split = await splitNarration(body, transcribeEndpoint, loadTestCode(), signal);
      if (signal.aborted) return;
      if (split === "unauthorized") {
        fail(messageForStatus(401));
        return;
      }
      body = split;
    }

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
