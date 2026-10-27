/**
 * POST /api/plan: one PlanRequest in, one NDJSON stream out.
 *
 * The browser runner (src/lib/client/apiPlanJob.ts) posts the picked
 * video's frames + narration and reads one PlanJobStatus per line:
 * running statuses in stage order, then a final done or failed line.
 * This route emits the first "uploading" status itself, right after
 * it parses the body; runPlan starts at "listening".
 *
 * Wiring: runPlan's step deps get the real Meta callers (ASR, SAM 3.1,
 * Muse Spark for reason + cost, Muse Image for the after image) plus
 * the per-request prompt builders from planPrompts.ts, so prompts 03
 * and 05 are filled with this request's frames, transcript, and region.
 * The shared usage tracker enforces the $10 spike cap in code, and
 * every call it records is logged server-side when the run finishes.
 *
 * No Meta API calls happen on import, and the key is read from
 * process.env only (MODEL_API_KEY or META_API_KEY) by the callers.
 * The UI never sees provider text: failures stream as PlanJobStatus
 * failed lines with plain messages, and the detail rides on the
 * server log only. Aborting the request stops the run.
 */

import {
  createCostSparkCaller,
  createMetaClient,
  createReasonSparkCaller,
} from "../../../lib/meta/client";
import { IMAGE_MODEL, createImageCaller } from "../../../lib/meta/image";
import { createSamSegmentCaller } from "../../../lib/meta/sam";
import { createAsrTranscribeCaller } from "../../../lib/meta/transcribe";
import {
  COST_PROMPT_TEMPLATE,
  COST_SCHEMA,
  REASON_PROMPT_TEMPLATE,
  REASON_SCHEMA,
  buildCostPrompt,
  buildReasonPrompt,
} from "../../../lib/pipeline/planPrompts";
import {
  planBodyTooLarge,
  validatePlanRequest,
} from "../../../lib/pipeline/planRequest";
import { createUsageTracker } from "../../../lib/pipeline/usage";
import { PlanStepError, runPlan } from "../../../lib/pipeline/runPlan";
import type { PlanJobStatus, PlanRequest, PlanStep } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NDJSON = { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" };

function line(status: PlanJobStatus): string {
  return `${JSON.stringify(status)}\n`;
}

function failedLine(step: Exclude<PlanStep, "done">, message: string): Response {
  return new Response(line({ state: "failed", step, message }), { headers: NDJSON });
}

function isAbort(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === "AbortError") ||
    (typeof err === "object" &&
      err !== null &&
      (err as { name?: unknown }).name === "AbortError")
  );
}

export async function POST(req: Request): Promise<Response> {
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return new Response("could not read request body", { status: 400 });
  }

  // Agreed cap: the browser builder stays under 9 MB; over 10 MB the
  // client shows its own too-large message from the 413.
  if (planBodyTooLarge(bodyText)) {
    return new Response("plan request body too large", { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return failedLine("uploading", "We couldn't read that plan request. Try again.");
  }

  const problems = validatePlanRequest(parsed);
  if (problems.length > 0) {
    console.error(`plan route: invalid request: ${problems.join("; ")}`);
    return failedLine("uploading", "That plan request was incomplete. Try again.");
  }
  const request = parsed as PlanRequest;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const push = (status: PlanJobStatus): void => {
        controller.enqueue(encoder.encode(line(status)));
      };
      push({ state: "running", step: "uploading" });

      let tracker;
      let wired = false;
      try {
        // Every caller throws here when no key is configured, so a
        // keyless deploy fails fast on "uploading", before any step.
        const meta = createMetaClient();
        tracker = createUsageTracker();
        const deps = {
          transcribe: { callTranscribe: createAsrTranscribeCaller(), tracker },
          segment: { callSegment: createSamSegmentCaller(), tracker },
          reason: {
            prompt: REASON_PROMPT_TEMPLATE,
            schema: REASON_SCHEMA,
            callSpark: createReasonSparkCaller(meta),
            tracker,
          },
          cost: {
            prompt: COST_PROMPT_TEMPLATE,
            schema: COST_SCHEMA,
            callSpark: createCostSparkCaller(meta),
            tracker,
          },
          renderAfter: { imageModel: IMAGE_MODEL, callImage: createImageCaller(), tracker },
          reasonPrompt: buildReasonPrompt,
          costPrompt: buildCostPrompt,
        };
        wired = true;
        const plan = await runPlan(request, {
          ...deps,
          tracker,
          onStatus: (status) => push(status),
          signal: req.signal,
        });
        push({ state: "done", plan });
        console.log(
          `plan route: done, spike total $${tracker.totals().spikeTotalUsd}, ` +
            `${tracker.records().length} calls: ` +
            tracker
              .records()
              .map((r) => `${r.model}/${r.step} $${r.costUsd} ${r.latencyMs}ms`)
              .join(", "),
        );
      } catch (err) {
        if (isAbort(err)) {
          // Client went away; nothing left to stream.
        } else if (err instanceof PlanStepError) {
          if (err.detail) console.error(`plan route: ${err.step} failed: ${err.detail}`);
          push({ state: "failed", step: err.step, message: err.message });
        } else if (!wired) {
          // Wiring failed (no key, or a caller could not be built).
          console.error(
            `plan route: wiring failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          push({
            state: "failed",
            step: "uploading",
            message: "The plan service isn't set up yet. Try the example plan.",
          });
        } else {
          console.error(
            `plan route: unexpected failure: ${err instanceof Error ? err.message : String(err)}`,
          );
          push({
            state: "failed",
            step: "planning",
            message: "Building the work plan failed. Try again.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: NDJSON });
}
