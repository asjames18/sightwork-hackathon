/**
 * POST /api/plan: one PlanRequest in, one NDJSON stream out.
 *
 * The browser runner (src/lib/client/apiPlanJob.ts) posts the picked
 * video's frames + narration and reads one PlanJobStatus per line:
 * running statuses in stage order, then a final done or failed line.
 * This route emits the first "uploading" status itself, right after
 * it parses the body; runPlan starts at "listening". Right after
 * validation it sends a second uploading line carrying the frame-count
 * check (uploadCheck), matching runPlan's check-line pattern, before
 * any wiring runs.
 *
 * Wiring: runPlan's step deps get the real callers plus the
 * per-request prompt builders from planPrompts.ts, so prompts 03
 * and 05 are filled with this request's frames, transcript, and region.
 * Reviewing (prompt 06): wired here with the reason step's provider
 * caller plus buildReviewPrompt, so a real run emits "reviewing" and
 * lands plan.review; a failed review ships ran:false, never a failed run.
 * Provider switch (PLAN_PROVIDER, default "baseten"): the reason step
 * — the main plan engine per Antonio's Oct 27 decision — runs on
 * Baseten Muse Spark Open, or on Meta Muse Spark when
 * PLAN_PROVIDER=meta. The other steps stay on Meta for now: the cost
 * step's prompt 05 needs web search, which the Baseten caller does
 * not offer, and SAM 3.1 / Muse Image are Meta-only steps that skip
 * cleanly when Meta is blocked. So a Meta key is still needed at
 * wiring time even in baseten mode; the reason engine is the only
 * step that moves. The plan's meta.planProvider records which engine
 * wrote the reason step, so a finished plan names its own engine.
 * SEGMENT_CONCURRENCY, when set to a whole number >= 1, caps SAM calls in
 * flight for the segment step; unset keeps the segment default.
 * The shared usage tracker enforces the $10 spike cap in code, and
 * every call it records is logged server-side when the run finishes, successfully or not.
 *
 * No Meta API calls happen on import, and the key is read from
 * process.env only (MODEL_API_KEY or META_API_KEY) by the callers.
 * The UI never sees provider text: failures stream as PlanJobStatus
 * failed lines with plain messages, and the detail rides on the
 * server log only. Aborting the request stops the run.
 */

import { createBasetenClient, createReasonBasetenCaller } from "../../../lib/meta/baseten";
import {
  createCostSparkCaller,
  createMetaClient,
  createReasonSparkCaller,
} from "../../../lib/meta/client";
import { IMAGE_MODEL, createImageCaller } from "../../../lib/meta/image";
import { createSamSegmentCaller } from "../../../lib/meta/sam";
import { createAsrTranscribeCaller } from "../../../lib/meta/transcribe";
import { buildReviewPrompt } from "../../../lib/reviewPrompt";
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
import { PlanStepError, REASON_MAX_FRAMES, runPlan } from "../../../lib/pipeline/runPlan";
import { uploadCheck } from "../../../lib/stepChecks";
import type { PlanJobStatus, PlanRequest, PlanStep } from "../../../lib/types";

export const runtime = "nodejs";

// Explicit Vercel function duration: 300 s is the Hobby maximum and
// the Pro default, so this states the platform limit rather than
// raising it. Plan runs take ~45-51 s, so time is not the binding
// limit on a hosted run; the 4.5 MB request-body cap is (see the
// 10 MB route cap below, which only applies before the platform cap).
export const maxDuration = 300;

/**
 * The reason step's provider, from PLAN_PROVIDER. Default "baseten"
 * (the main plan engine per Antonio's Oct 27 decision); "meta" runs
 * the reason step on Meta Muse Spark instead. Anything else fails
 * fast here, before any step runs, so a typo never silently picks
 * an engine. Takes an env record so tests can pass one in; defaults
 * to process.env.
 */
export function resolvePlanProvider(
  env: Record<string, string | undefined> = process.env,
): "baseten" | "meta" {
  const raw = env.PLAN_PROVIDER?.trim().toLowerCase();
  if (raw === undefined || raw === "") return "baseten";
  if (raw === "baseten" || raw === "meta") return raw;
  throw new Error(`plan route: unknown PLAN_PROVIDER "${env.PLAN_PROVIDER}" (want baseten or meta)`);
}

/**
 * SAM concurrency for the segment step, from SEGMENT_CONCURRENCY.
 * Blank/unset keeps runSegment's own default (DEFAULT_SEGMENT_CONCURRENCY);
 * a whole number >= 1 is passed through to runPlan as segmentConcurrency.
 * Anything else fails fast here, before any step runs, so a typo never
 * silently picks a pool size. Takes an env record so tests can pass one
 * in; defaults to process.env.
 */
export function resolveSegmentConcurrency(
  env: Record<string, string | undefined> = process.env,
): number | undefined {
  const raw = env.SEGMENT_CONCURRENCY?.trim();
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `plan route: unknown SEGMENT_CONCURRENCY "${env.SEGMENT_CONCURRENCY}" (want a whole number >= 1)`,
    );
  }
  return value;
}

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
    // JSON {error} (not plain text) so the client can surface this
    // message on a non-OK response instead of only its generic one.
    return new Response(JSON.stringify({ error: "could not read request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Agreed cap: the browser builder stays under 9 MB; over 10 MB the
  // client shows its own too-large message from the 413.
  if (planBodyTooLarge(bodyText)) {
    // JSON {error} (not plain text) so the client can surface this
    // message on a non-OK response; the client still keys its
    // too-large message off the 413 status, so this changes no UI yet.
    return new Response(JSON.stringify({ error: "plan request body too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
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
      // Uploading check (2026-10-30): the request is already validated,
      // so the frame count is the check — one more running line for the
      // same step, as runPlan does for its steps. Sharp swaps are
      // browser-side only and are not in the request, so the note is
      // the count alone, matching stepChecksForPlan on the finished plan.
      push({ state: "running", step: "uploading", check: uploadCheck(request.frames.length) });

      let tracker: ReturnType<typeof createUsageTracker> | undefined;
      let wired = false;
      try {
        // Every caller throws here when no key is configured, so a
        // keyless deploy fails fast on "uploading", before any step.
        const meta = createMetaClient();
        tracker = createUsageTracker();
        const provider = resolvePlanProvider();
        const segmentConcurrency = resolveSegmentConcurrency();
        const reasonCaller =
          provider === "baseten"
            ? createReasonBasetenCaller(createBasetenClient())
            : createReasonSparkCaller(meta);
        const deps = {
          transcribe: { callTranscribe: createAsrTranscribeCaller(), tracker },
          segment: { callSegment: createSamSegmentCaller(), tracker },
          reason: {
            prompt: REASON_PROMPT_TEMPLATE,
            schema: REASON_SCHEMA,
            callSpark: reasonCaller,
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
          // Reviewing (prompt 06, 2026-10-30): the reviewer runs on the
          // same provider caller as the reason step (Baseten Muse Spark
          // Open in baseten mode, Meta Muse Spark in meta mode) with
          // Grok Bot's buildReviewPrompt builder, so a finished plan
          // carries plan.review. Reviewing never fails a run: runPlan
          // ships ran:false on any review failure. No timeout is
          // plumbed here: prompt 06 suggests 60 s (measured max 29 s),
          // but the caller interfaces carry no timeout/signal, and
          // racing the call would drop its usage record, so the route
          // relies on maxDuration above; see mosheh-log for the open
          // question on plumbing a real timeout.
          review: { callSpark: reasonCaller },
          reviewPrompt: buildReviewPrompt,
        };
        wired = true;
        const plan = await runPlan(request, {
          ...deps,
          tracker,
          planProvider: provider,
          segmentConcurrency,
          // Baseten reason cap (2026-10-27): the
          // reason step takes at most 8 images in baseten mode;
          // runPlan subsets and remaps. Meta mode is untouched.
          reasonMaxFrames: provider === "baseten" ? REASON_MAX_FRAMES : undefined,
          onStatus: (status) => push(status),
          signal: req.signal,
        });
        push({ state: "done", plan });
        console.log(
          `plan route: done, provider ${plan.meta?.planProvider ?? "unset"}, ` +
            `skipped ${JSON.stringify(plan.meta?.skipped ?? {})}, ` +
            `spike total $${tracker.totals().spikeTotalUsd}, ` +
            `${tracker.records().length} calls: ` +
            tracker
              .records()
              .map((r) => `${r.model}/${r.step} $${r.costUsd} ${r.latencyMs}ms`)
              .join(", ") +
            `; per-model ` +
            tracker
              .totalsByModel()
              .map((m) => `${m.model}: ${m.calls} calls $${m.totalUsd}`)
              .join(", "),
        );
      } catch (err) {
        // A failed run still spent model calls: log the partial usage
        // so spike tracking has real data even when no plan comes back.
        if (tracker) {
          console.error(
            `plan route: failed after ${tracker.records().length} calls, ` +
              `spike total $${tracker.totals().spikeTotalUsd}: ` +
              tracker
                .records()
                .map((r) => `${r.model}/${r.step} $${r.costUsd} ${r.latencyMs}ms`)
                .join(", ") +
              `; per-model ` +
              tracker
                .totalsByModel()
                .map((m) => `${m.model}: ${m.calls} calls $${m.totalUsd}`)
                .join(", "),
          );
        }
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
