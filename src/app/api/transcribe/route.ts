/**
 * POST /api/transcribe: one narration WAV in, one transcript out.
 *
 * Option (b) for the Vercel 4.5 MB body cap (Grok Bot, 2026-10-29
 * 9:50 PM): the browser calls this route first with the narration
 * alone, then sends the plan request carrying the transcript instead
 * of the WAV, so a 45-60 s narrated take no longer has to fit frames
 * plus audio inside one 4.5 MB plan request. The transcribe request
 * itself still carries the WAV, so it is still under the same
 * platform cap: 16 kHz mono WAV is ~32 KB/s, so ~140 s of narration
 * fits; longer takes still get a platform 413 on this route.
 *
 * Request (JSON): { audioWavBase64?: string, spaceType?: string } —
 * the same fields as TranscribeInput in src/lib/pipeline/transcribe.ts.
 * Omit audioWavBase64 (or send "") for no narration: no call is made
 * and the response is the empty transcript, without needing a key.
 * Response (JSON): { transcript: string | null, transcriptTurns: [] }
 * in the TranscribeOutput shape, one "[t] text" line per turn.
 * Errors are JSON { error } with a plain message; the detail rides
 * on the server log only, like the plan route's failed lines.
 *
 * Wiring mirrors the plan route's transcribe deps (Meta ASR caller,
 * per-request usage tracker enforcing the $10 spike cap in code).
 * The plan route does not pass a cleanup prompt, so neither does
 * this route: raw turns are returned as-is. No call happens on
 * import, and the key is read from process.env only by the caller.
 */

import { createAsrTranscribeCaller } from "../../../lib/meta/transcribe";
import {
  runTranscribe,
  validateTranscribeInput,
} from "../../../lib/pipeline/transcribe";
import { createUsageTracker } from "../../../lib/pipeline/usage";

export const runtime = "nodejs";

// Explicit Vercel function duration: 300 s is the Hobby maximum and
// the Pro default, so this states the platform limit rather than
// raising it. A transcribe call is seconds, not minutes; time is not
// the binding limit on a hosted run, the 4.5 MB request-body cap is.
export const maxDuration = 300;

export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Content-Type": "application/json" };

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

export async function POST(req: Request): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await req.text());
  } catch {
    return errorResponse("could not read transcribe request", 400);
  }

  try {
    validateTranscribeInput(parsed as { audioWavBase64?: string; spaceType?: string });
  } catch (err) {
    console.error(`transcribe route: invalid request: ${err instanceof Error ? err.message : String(err)}`);
    return errorResponse("That transcribe request was incomplete. Try again.", 400);
  }
  const input = parsed as { audioWavBase64?: string; spaceType?: string };

  // No narration means no call and no key needed: a keyless deploy
  // answers the empty transcript instead of failing on caller setup.
  if (!input.audioWavBase64) {
    return new Response(JSON.stringify({ transcript: null, transcriptTurns: [] }), {
      headers: JSON_HEADERS,
    });
  }

  try {
    const out = await runTranscribe(input, {
      callTranscribe: createAsrTranscribeCaller(),
      tracker: createUsageTracker(),
    });
    return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
  } catch (err) {
    console.error(`transcribe route: ${err instanceof Error ? err.message : String(err)}`);
    return errorResponse("We couldn't transcribe that narration. Try again.", 500);
  }
}
