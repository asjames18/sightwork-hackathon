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
 * would silently mislabel times and subset positions. Each frame's
 * dataUrl must be a data:image base64 URL with a valid base64 payload:
 * the browser builder sends canvas JPEG data URLs, and a bare data:image
 * string (or a non-image string) would otherwise pass here and only
 * surface later, when the segment step skips and the plan silently loses
 * segmentation. A garbage payload would pass the prefix check the same
 * way, so the payload is checked with the same base64 rule as audio.
 * A frame's tSec must not exceed
 * durationSec: the browser builder samples frames from the video
 * itself, so a later timestamp would mislabel that proof frame's
 * time on the plan screen. audioWavBase64 must be valid base64 when
 * present: the transcribe step rejects anything else, so a malformed
 * string would otherwise fail the run at "listening" instead of here
 * on "uploading", before any model call is spent. It must also carry
 * a WAV header: the transcribe step throws on a non-WAV payload with
 * the same RIFF/WAVE rule, so a valid-base64 MP3 (or any other blob)
 * would otherwise pass here and fail at "listening" instead of here
 * on "uploading".
 */

/**
 * True when the string is valid base64, by the same rule the
 * transcribe step enforces (src/lib/pipeline/transcribe.ts):
 * whitespace ignored, alphabet plus up to two padding chars, length
 * a multiple of 4. An empty string passes here because the transcribe
 * step treats it as no audio, not as malformed audio.
 */
function isBase64(value: string): boolean {
  const stripped = value.replace(/\s/g, "");
  return /^[A-Za-z0-9+/]*={0,2}$/.test(stripped) && stripped.length % 4 === 0;
}

/**
 * True when the base64 string decodes to a WAV header, by the same
 * rule the transcribe step enforces (src/lib/pipeline/transcribe.ts):
 * the first four bytes are "RIFF" and bytes 8-11 are "WAVE". An empty
 * string passes here because the transcribe step treats it as no
 * audio, not as malformed audio. Decoded with atob (not Buffer) so
 * this pure module stays free of node types.
 */
function isWavBase64(value: string): boolean {
  const stripped = value.replace(/\s/g, "");
  if (stripped.length === 0) return true;
  if (stripped.length < 16) return false;
  const head = atob(stripped.slice(0, 16));
  return head.length >= 12 && head.slice(0, 4) === "RIFF" && head.slice(8, 12) === "WAVE";
}

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
      } else if (
        typeof req.durationSec === "number" &&
        Number.isFinite(req.durationSec) &&
        req.durationSec >= 0 &&
        frame.tSec > req.durationSec
      ) {
        problems.push(`frames[${i}].tSec must not exceed durationSec`);
      } else {
        prevTsec = frame.tSec;
      }
      if (
        typeof frame.dataUrl !== "string" ||
        !frame.dataUrl.startsWith("data:image/") ||
        !frame.dataUrl.includes(";base64,")
      ) {
        problems.push(`frames[${i}].dataUrl must be a data:image base64 URL`);
      } else {
        const payload = frame.dataUrl.slice(frame.dataUrl.indexOf(";base64,") + 8);
        if (payload.length === 0 || !isBase64(payload)) {
          problems.push(`frames[${i}].dataUrl must carry valid base64 image data`);
        }
      }
    });
  }

  for (const key of ["spaceName", "spaceType", "region"]) {
    if (req[key] !== undefined && typeof req[key] !== "string") {
      problems.push(`${key} must be a string`);
    }
  }
  if (req.audioWavBase64 !== undefined) {
    if (typeof req.audioWavBase64 !== "string") {
      problems.push("audioWavBase64 must be a string");
    } else if (!isBase64(req.audioWavBase64)) {
      problems.push("audioWavBase64 must be valid base64");
    } else if (!isWavBase64(req.audioWavBase64)) {
      problems.push("audioWavBase64 must be a WAV file (RIFF/WAVE header)");
    }
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


