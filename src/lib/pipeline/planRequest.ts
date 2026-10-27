/**
 * SightWork plan-request validation.
 *
 * Pure checks for the JSON body POSTed to /api/plan, run before any
 * pipeline step so a malformed body fails fast on "uploading" with a
 * plain message instead of halfway through a model run. Shape only:
 * it does not judge whether the frames or audio will produce a good
 * plan (an empty frames array is rejected here, before any model
 * call is spent on a run that cannot produce a plan). No API calls, no keys, and no
 * provider text in the problems it returns.
 */

/** Agreed route cap: the browser builder stays under 9 MB, the route rejects over 10 MB. */
export const MAX_PLAN_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Agreed frame cap: the browser builder sends at most 48 frames
 * (prompt 02, under the 50-images-per-request limit), so a request
 * over 48 is not something the UI produces. Rejecting it here fails
 * fast on "uploading" before any model call is spent on a run that
 * would blow the spike cap mid-pipeline.
 */
export const MAX_PLAN_FRAMES = 48;

/** True when the raw request text is over the route body cap. */
export function planBodyTooLarge(bodyText: string): boolean {
  return new TextEncoder().encode(bodyText).length > MAX_PLAN_BODY_BYTES;
}

/**
 * Problems with a parsed /api/plan body; [] = valid. Follows the
 * checkWorkPlan convention (a list, not a throw) so the route can map
 * the first problem to a plain failure message. Frames must also be
 * in walkthrough order (non-decreasing tSec): the reason subset
 * picks evenly spaced frames by position, so an out-of-order request
 * would silently mislabel times and subset positions.
 */
export function validatePlanRequest(body: unknown): string[] {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return ["plan request must be a JSON object"];
  }
  const req = body as Record<string, unknown>;
  const problems: string[] = [];

  if (typeof req.durationSec !== "number" || !Number.isFinite(req.durationSec) || req.durationSec < 0) {
    problems.push("durationSec must be a number >= 0");
  }

  if (!Array.isArray(req.frames)) {
    problems.push("frames must be an array");
  } else if (req.frames.length === 0) {
    problems.push("frames must not be empty");
  } else if (req.frames.length > MAX_PLAN_FRAMES) {
    problems.push(`frames must not exceed ${MAX_PLAN_FRAMES}`);
  } else {
    let prevTsec = -Infinity;
    req.frames.forEach((f, i) => {
      if (f === null || typeof f !== "object" || Array.isArray(f)) {
        problems.push(`frames[${i}] must be an object`);
        return;
      }
      const frame = f as Record<string, unknown>;
      if (typeof frame.tSec !== "number" || !Number.isFinite(frame.tSec) || frame.tSec < 0) {
        problems.push(`frames[${i}].tSec must be a number >= 0`);
      } else if (frame.tSec < prevTsec) {
        problems.push(`frames[${i}].tSec must not be earlier than the previous frame`);
      } else {
        prevTsec = frame.tSec;
      }
      if (typeof frame.dataUrl !== "string" || frame.dataUrl.length === 0) {
        problems.push(`frames[${i}].dataUrl must be a non-empty string`);
      }
    });
  }

  for (const key of ["spaceName", "spaceType", "region"]) {
    if (req[key] !== undefined && typeof req[key] !== "string") {
      problems.push(`${key} must be a string`);
    }
  }
  if (req.audioWavBase64 !== undefined && typeof req.audioWavBase64 !== "string") {
    problems.push("audioWavBase64 must be a string");
  }
  if (
    req.laborBasis !== undefined &&
    req.laborBasis !== "volunteer" &&
    req.laborBasis !== "contractor" &&
    req.laborBasis !== "mixed"
  ) {
    problems.push("laborBasis must be volunteer, contractor, or mixed");
  }
  return problems;
}

