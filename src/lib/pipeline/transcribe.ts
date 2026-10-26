/**
 * SightWork pipeline step: `transcribe`.
 *
 * Turns the narration WAV from a PlanRequest into the transcript lines
 * the reason step reads (prompt 01 in the planning repo, owned by
 * Grok Bot). When there is no audio, no call is made and the result is
 * empty: transcript null, transcriptTurns []. The reason step then
 * runs on frames alone with every issue unmentioned.
 *
 * This module makes no API calls and holds no keys. The ASR caller and
 * the optional Spark cleanup caller are injected by the wiring code
 * (later: src/lib/meta), so the step is testable on mock data and the
 * spike can swap callers without touching this logic. Every would-be
 * call is recorded on the usage tracker from ./usage.ts, so the $10
 * spike cap is enforced in code.
 *
 * ASR settings (prompt 01, enforced by the caller, not here):
 * - model muse-voice-transcribe-1.0; confirm the ID at the first spike
 * - WAV, mono, 16-bit PCM, 16 or 24 kHz; max 32 MB / 10 min
 * - diarization off (one speaker); Standard mode, never -contributor
 *   (contributor mode lets Meta train on the content; this is church
 *   footage)
 *
 * Post-processing (all in the prompt file, enforced here, not trusted
 * to the model):
 * - drop empty turns; no turn with text means transcript null
 * - transcript is built from transcriptTurns, so the two never disagree
 * - cleanup is discarded if it changes the line count or any [t]
 *   prefix, and the raw turns are used instead
 */

import type { TranscriptTurn } from "../types";
import type { UsageTracker } from "./usage";

/** Model ID from prompt 01; confirm it at the first spike. */
export const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";
export const CLEANUP_MODEL = "muse-spark";

/** Max audio size from prompt 01 (32 MB). */
export const MAX_AUDIO_BYTES = 32 * 1024 * 1024;

/** Default keyword bias from prompt 01 (church walkthrough terms). */
export const DEFAULT_KEYWORD_BIAS = [
  "exit sign",
  "egress",
  "riser",
  "platform",
  "baptistry",
  "pulpit",
  "choir loft",
  "truss",
  "ceiling tile",
  "water stain",
  "gaffer tape",
  "cable cover",
  "power strip",
  "extension cord",
  "fire extinguisher",
  "ADA",
  "ramp",
  "handrail",
  "sconce",
  "can light",
  "folding chair",
  "pew",
  "upholstery",
  "drywall",
  "baseboard",
  "sound booth",
  "monitor wedge",
  "subwoofer",
];

/** One ASR turn as the caller returns it (unknown shape, validated here). */
export interface RawTurn {
  startSec: number;
  endSec?: number;
  text: string;
}

/** A model call supplied by the wiring code. Never a real call in tests. */
export interface TranscribeCaller {
  (req: {
    model: string;
    /** Standard mode only; never contributor mode. */
    mode: "standard";
    audioWavBase64: string;
    keywordBias: string[];
  }): Promise<{ turns: unknown; latencyMs: number; costUsd: number }>;
}

/** Optional Spark cleanup caller; omitted means no cleanup pass. */
export interface CleanupCaller {
  (req: { model: string; prompt: string }): Promise<{
    text: string;
    latencyMs: number;
    costUsd: number;
  }>;
}

export interface TranscribeInput {
  /** Base64 WAV (mono, 16-bit PCM, 16 or 24 kHz). Omit for no narration. */
  audioWavBase64?: string;
  spaceType?: string;
}

export interface TranscribeOutput {
  /** One line per turn: "[startSec] text", startSec to one decimal. */
  transcript: string | null;
  transcriptTurns: TranscriptTurn[];
}

export interface TranscribeDeps {
  callTranscribe: TranscribeCaller;
  tracker: UsageTracker;
  keywordBias?: string[];
  /**
   * Cleanup prompt template with {{raw_turns}}, {{space_type}} and
   * {{keyword_bias}} placeholders. When set together with callCleanup,
   * the cleanup pass runs; otherwise raw turns are used as-is.
   */
  cleanupPrompt?: string;
  callCleanup?: CleanupCaller;
}

/** Validate raw ASR output into turns: drop empties, enforce time order. */
export function parseTurns(raw: unknown): TranscriptTurn[] {
  if (!Array.isArray(raw)) {
    throw new Error("transcribe: ASR output is not a turn array");
  }
  const turns: TranscriptTurn[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i] as Record<string, unknown>;
    if (t === null || typeof t !== "object" || Array.isArray(t)) {
      throw new Error(`transcribe: turn ${i} is not an object`);
    }
    if (typeof t.startSec !== "number" || !Number.isFinite(t.startSec) || t.startSec < 0) {
      throw new Error(`transcribe: turn ${i} has no valid startSec`);
    }
    if (t.endSec !== undefined && (typeof t.endSec !== "number" || t.endSec < t.startSec)) {
      throw new Error(`transcribe: turn ${i} has an invalid endSec`);
    }
    if (typeof t.text !== "string") {
      throw new Error(`transcribe: turn ${i} has no text`);
    }
    const text = t.text.trim();
    if (!text) continue;
    turns.push({
      startSec: t.startSec,
      ...(t.endSec !== undefined ? { endSec: t.endSec } : {}),
      text,
    });
  }
  turns.sort((a, b) => a.startSec - b.startSec);
  return turns;
}

/** Build the "[t] text" string from turns, one line per turn. */
export function buildTranscript(turns: TranscriptTurn[]): string | null {
  if (turns.length === 0) return null;
  return turns.map((t) => `[${t.startSec.toFixed(1)}] ${t.text}`).join("\n");
}

/**
 * Parse cleaned lines back into turns by their [t] prefix, keeping
 * endSec from the raw turn. Returns null when the line count or any
 * prefix changed, so the caller discards the cleanup and uses raw.
 */
export function applyCleanup(
  rawTurns: TranscriptTurn[],
  cleanedText: string,
): TranscriptTurn[] | null {
  const lines = cleanedText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length !== rawTurns.length) return null;
  const out: TranscriptTurn[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\[(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(lines[i]);
    if (!m) return null;
    if (Math.abs(parseFloat(m[1]) - rawTurns[i].startSec) > 0.051) return null;
    const text = m[2].trim();
    if (!text) return null;
    out.push({
      startSec: rawTurns[i].startSec,
      ...(rawTurns[i].endSec !== undefined ? { endSec: rawTurns[i].endSec } : {}),
      text,
    });
  }
  return out;
}

function audioByteLength(base64: string): number {
  const stripped = base64.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(stripped) || stripped.length % 4 !== 0) {
    throw new Error("transcribe: audioWavBase64 is not valid base64");
  }
  return Math.floor((stripped.length * 3) / 4);
}

export async function runTranscribe(
  input: TranscribeInput,
  deps: TranscribeDeps,
): Promise<TranscribeOutput> {
  if (!input.audioWavBase64) {
    return { transcript: null, transcriptTurns: [] };
  }
  const bytes = audioByteLength(input.audioWavBase64);
  if (bytes > MAX_AUDIO_BYTES) {
    throw new Error(
      `transcribe: audio is ${bytes} bytes, over the ${MAX_AUDIO_BYTES} byte limit`,
    );
  }
  if (bytes >= 12) {
    const head = Buffer.from(input.audioWavBase64, "base64").subarray(0, 12).toString("latin1");
    if (head.slice(0, 4) !== "RIFF" || head.slice(8, 12) !== "WAVE") {
      throw new Error("transcribe: audio is not a WAV file (missing RIFF/WAVE header)");
    }
  }

  const res = await deps.callTranscribe({
    model: TRANSCRIBE_MODEL,
    mode: "standard",
    audioWavBase64: input.audioWavBase64,
    keywordBias: deps.keywordBias ?? DEFAULT_KEYWORD_BIAS,
  });
  // The tracker enforces the spike cap: a throw here stops the run.
  deps.tracker.record({
    model: TRANSCRIBE_MODEL,
    step: "transcribe",
    latencyMs: res.latencyMs,
    costUsd: res.costUsd,
  });

  const rawTurns = parseTurns(res.turns);
  if (rawTurns.length === 0) {
    return { transcript: null, transcriptTurns: [] };
  }

  let turns = rawTurns;
  if (deps.cleanupPrompt && deps.callCleanup) {
    const rawText = buildTranscript(rawTurns) as string;
    const prompt = deps.cleanupPrompt
      .replaceAll("{{raw_turns}}", rawText)
      .replaceAll("{{space_type}}", input.spaceType ?? "church sanctuary")
      .replaceAll("{{keyword_bias}}", (deps.keywordBias ?? DEFAULT_KEYWORD_BIAS).join(", "));
    const cleaned = await deps.callCleanup({ model: CLEANUP_MODEL, prompt });
    deps.tracker.record({
      model: CLEANUP_MODEL,
      step: "transcribe-cleanup",
      latencyMs: cleaned.latencyMs,
      costUsd: cleaned.costUsd,
    });
    // Discard the cleanup if it changed line count or any prefix.
    turns = applyCleanup(rawTurns, cleaned.text) ?? rawTurns;
  }

  return { transcript: buildTranscript(turns), transcriptTurns: turns };
}
