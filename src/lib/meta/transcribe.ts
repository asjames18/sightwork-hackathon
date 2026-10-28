/**
 * SightWork Muse Voice Transcribe caller (transcribe step).
 *
 * This is the caller the transcribe step injects (see src/lib/pipeline/transcribe.ts):
 * the step itself records every call on the usage tracker, so the $10
 * spike cap is still enforced there.
 *
 * - Base URL: https://api.meta.ai/v1 (ASR API, NOT the Responses API).
 *   Override with opts.baseUrl or the META_API_BASE_URL env var.
 * - Key: opts.apiKey, or MODEL_API_KEY, or META_API_KEY from the
 *   environment. The key is never logged, never stored, and never sent
 *   anywhere except the Authorization header of the Meta API call.
 * - This module makes no call on import. No call happens until a caller
 *   returned here is invoked, and tests inject a fake fetch instead.
 * - Shape verified live by the spike (Oct 26, Grok Bot): POST
 *   /v1/asr/transcribe?sessionId=<id>, multipart/form-data with a
 *   `request` JSON part and an `audio` WAV part. The step passes
 *   mode "standard" (non-diarization, non-contributor); the wire mode
 *   that actually returns turns with diarization off is "ENDPOINTING"
 *   (PUSH_TO_TALK returns turns: [] and only a flat transcript), so
 *   that is what this caller sends. There is no contributor variant
 *   for ASR, so the never-contributor rule is met automatically.
 * - Response: { sessionId, transcript, audioDurationMs, turns: [{
 *   turnId, startMs, endMs, transcript }] }. Turns map to the step's
 *   { startSec, endSec, text } (startMs/1000, endMs/1000, transcript).
 *   No narration is a 200 with an empty transcript and turns: [];
 *   the caller returns turns: [] and the step turns that into
 *   transcript null, transcriptTurns [] — not an error.
 * - Cost: $0.18/hour, billed by whole seconds rounded down:
 *   floor(audioDurationMs/1000)/3600*0.18. There is no usage field,
 *   so the caller computes it (spike: 42 s cost $0.0021). When the
 *   response omits audioDurationMs, the last turn's endMs is used.
 * - A 500 is retried once (spike note); other failures fail loudly
 *   with status + body, per the pipeline's rule.
 */

export interface AsrClientOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Injectable fetch for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** USD per hour of audio. Default: $0.18 (spike-verified). */
  pricePerHourUsd?: number;
}

/** One ASR turn, already in the transcribe step's shape. */
export interface AsrTurn {
  startSec: number;
  endSec: number;
  text: string;
}

export interface AsrTranscribeCaller {
  (req: {
    model: string;
    /** Step's mode literal; the wire mode sent is ENDPOINTING (see header). */
    mode: "standard";
    audioWavBase64: string;
    keywordBias: string[];
  }): Promise<{ turns: AsrTurn[]; latencyMs: number; costUsd: number }>;
}

const DEFAULT_BASE_URL = "https://api.meta.ai/v1";
const DEFAULT_PRICE_PER_HOUR_USD = 0.18;

/** Wire mode that returns turns with diarization off (spike-verified). */
export const ASR_MODE = "ENDPOINTING" as const;

/** Cost of audio of the given length, whole seconds rounded down. */
export function computeAsrCostUsd(durationMs: number, pricePerHourUsd = DEFAULT_PRICE_PER_HOUR_USD): number {
  // A bad duration or price would otherwise surface later, mid-run,
  // when the transcribe step records the call and the usage tracker
  // rejects it with a generic cost message. The caller checks the
  // provider duration only for finiteness, so a negative duration
  // would reach here; reject both bad inputs here, at the cost
  // computation, like the caller rejects a bad price at creation.
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error(`asr: durationMs must be a finite number >= 0, got ${durationMs}`);
  }
  if (!Number.isFinite(pricePerHourUsd) || pricePerHourUsd < 0) {
    throw new Error(`asr: pricePerHourUsd must be a finite number >= 0, got ${pricePerHourUsd}`);
  }
  return (Math.floor(durationMs / 1000) / 3600) * pricePerHourUsd;
}

function readEnv(name: string): string | undefined {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const v = env?.[name];
    return v && v.trim() ? v : undefined;
  } catch {
    return undefined;
  }
}

function mapTurns(raw: unknown): AsrTurn[] {
  if (!Array.isArray(raw)) throw new Error("asr: response turns is not an array");
  return raw.map((t, i) => {
    if (t === null || typeof t !== "object" || Array.isArray(t)) {
      throw new Error(`asr: turn ${i} is not an object`);
    }
    const turn = t as Record<string, unknown>;
    if (typeof turn.startMs !== "number" || !Number.isFinite(turn.startMs) || turn.startMs < 0) {
      throw new Error(`asr: turn ${i} has no valid startMs`);
    }
    if (typeof turn.endMs !== "number" || !Number.isFinite(turn.endMs) || turn.endMs < turn.startMs) {
      throw new Error(`asr: turn ${i} has no valid endMs`);
    }
    if (typeof turn.transcript !== "string") {
      throw new Error(`asr: turn ${i} has no transcript text`);
    }
    return { startSec: turn.startMs / 1000, endSec: turn.endMs / 1000, text: turn.transcript };
  });
}

export function createAsrTranscribeCaller(opts: AsrClientOptions = {}): AsrTranscribeCaller {
  const apiKey = opts.apiKey ?? readEnv("MODEL_API_KEY") ?? readEnv("META_API_KEY");
  if (!apiKey) {
    throw new Error(
      "asr: no API key found. Set MODEL_API_KEY (or META_API_KEY) in the environment; the key is never committed or logged.",
    );
  }
  const baseUrl = (opts.baseUrl ?? readEnv("META_API_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const pricePerHour = opts.pricePerHourUsd ?? DEFAULT_PRICE_PER_HOUR_USD;
  // A bad hourly price would only surface later, mid-run, when the
  // transcribe step records the call and the usage tracker rejects it.
  // Reject it here, at caller creation, like the tracker rejects bad
  // opts, so a misconfigured price fails fast before any ASR call.
  if (!Number.isFinite(pricePerHour) || pricePerHour < 0) {
    throw new Error(`asr: pricePerHourUsd must be a finite number >= 0, got ${opts.pricePerHourUsd}`);
  }

  return async (req) => {
    // A bad request would otherwise spend a paid ASR call and only
    // fail downstream, when the transcribe step parses an empty or
    // garbage result. Reject it here, before any fetch, like the
    // SAM and Image callers reject bad requests at the same point.
    if (typeof req.model !== "string" || req.model.trim().length === 0) {
      throw new Error("asr: model must be a non-empty string");
    }
    if (req.mode !== "standard") {
      throw new Error(`asr: mode must be "standard", got ${String(req.mode)}`);
    }
    if (typeof req.audioWavBase64 !== "string" || req.audioWavBase64.trim().length === 0) {
      throw new Error("asr: audioWavBase64 must be a non-empty string");
    }
    const b64 = req.audioWavBase64.trim();
    if (b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || Buffer.from(b64, "base64").length === 0) {
      throw new Error("asr: audioWavBase64 must be valid base64 audio data");
    }
    if (!Array.isArray(req.keywordBias) || req.keywordBias.some((k) => typeof k !== "string")) {
      throw new Error("asr: keywordBias must be an array of strings");
    }
    const sessionId = `sightwork-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const form = new FormData();
    form.append(
      "request",
      new Blob(
        [
          JSON.stringify({
            mode: ASR_MODE,
            model: req.model,
            audioEncoding: "WAV",
            keywords: req.keywordBias,
          }),
        ],
        { type: "application/json" },
      ),
    );
    const audioBytes = Buffer.from(req.audioWavBase64, "base64");
    form.append("audio", new Blob([audioBytes], { type: "audio/wav" }), "audio.wav");

    const started = Date.now();
    let res: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetchImpl(`${baseUrl}/asr/transcribe?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (res.status !== 500 || attempt === 1) break;
    }
    const latencyMs = Date.now() - started;
    if (!res || !res.ok) {
      const detail = res ? await res.text() : "no response";
      throw new Error(`asr: ${res ? res.status : "?"} ${detail}`);
    }
    const parsed = (await res.json()) as Record<string, unknown>;
    const turns = mapTurns(parsed.turns);
    const durationMs =
      typeof parsed.audioDurationMs === "number" && Number.isFinite(parsed.audioDurationMs)
        ? parsed.audioDurationMs
        : turns.length > 0
          ? turns[turns.length - 1].endSec * 1000
          : 0;
    return { turns, latencyMs, costUsd: computeAsrCostUsd(durationMs, pricePerHour) };
  };
}
