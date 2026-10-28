/**
 * SightWork SAM 3.1 caller (segment step).
 *
 * This is the caller the segment step injects (see src/lib/pipeline/segment.ts):
 * one concept on one frame per request, over the Meta Responses API.
 * The step itself records every call on the usage tracker, so the $10
 * spike cap is still enforced there.
 *
 * - Base URL: https://api.meta.ai/v1 (Responses API, POST /responses).
 *   Override with opts.baseUrl or the META_API_BASE_URL env var.
 * - Key: opts.apiKey, or MODEL_API_KEY, or META_API_KEY from the
 *   environment. The key is never logged, never stored, and never sent
 *   anywhere except the Authorization header of the Meta API call.
 * - This module makes no call on import. No call happens until a caller
 *   returned here is invoked, and tests inject a fake fetch instead.
 * - Scores need metadata.include_confidence as the STRING "true", not a
 *   boolean: without it SAM returns no `c` on the box tokens and the
 *   segment step's minScore filter has nothing to filter on (spike
 *   note, Oct 26). mask_encoding "one_bit" keeps payloads smallest;
 *   masks are not used downstream, so they are parsed out and dropped.
 * - Cost: $2.50 per 1,000 images = $0.0025 per request (one concept on
 *   one frame). The spike wiring may override via opts once live
 *   billing is confirmed.
 * - Provider errors are surfaced verbatim (status + body) so a failing
 *   step fails loudly instead of guessing, per the segment step's rule.
 * - Empty output_text is a valid result (zero matches), not an error.
 */

import type { Box } from "../types";

export interface SamClientOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Injectable fetch for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** USD charged per request. Default: $2.50 per 1,000 images. */
  requestCostUsd?: number;
}

/** One SAM instance, box already normalized to 0-1000 [x1, y1, x2, y2]. */
export interface SamInstance {
  score: number;
  box?: Box;
}

export interface SamSegmentCaller {
  (req: {
    model: string;
    /** Noun-phrase concept, e.g. "chair". */
    concept: string;
    /** Index into the plan's frames array. */
    frameIndex: number;
    /** Data URL of the still image. */
    dataUrl: string;
  }): Promise<{ instances: SamInstance[]; latencyMs: number; costUsd: number }>;
}

const DEFAULT_BASE_URL = "https://api.meta.ai/v1";
const DEFAULT_REQUEST_COST_USD = 0.0025;

/** The SAM request must carry confidence as a string, not a boolean. */
export const SAM_METADATA = {
  include_confidence: "true",
  mask_encoding: "one_bit",
} as const;

function readEnv(name: string): string | undefined {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const v = env?.[name];
    return v && v.trim() ? v : undefined;
  } catch {
    return undefined;
  }
}

function extractText(body: Record<string, unknown>): string | null {
  if (typeof body.output_text === "string") return body.output_text;
  const output = body.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (item === null || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part !== null && typeof part === "object" && (part as Record<string, unknown>).type === "output_text") {
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string") return text;
      }
    }
  }
  return null;
}

function parseNumber(fields: Record<string, string>, key: string): number {
  const raw = fields[key];
  if (raw === undefined) throw new Error(`sam: box token is missing ${key}`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`sam: box token has a non-numeric ${key}`);
  return value;
}

/**
 * Parse SAM's special-token output_text into instances. Only box tokens
 * are read; mask tokens are ignored. Boxes arrive in source pixels with
 * w/h on the token and are normalized to 0-1000 here, as the segment
 * step expects. A box token without a score fails loudly: without `c`
 * the segment step cannot apply its minScore filter.
 */
export function parseSamOutput(outputText: string): SamInstance[] {
  const instances: SamInstance[] = [];
  const tokenPattern = /<\|box;([^|]*)\|>/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(outputText)) !== null) {
    const fields: Record<string, string> = {};
    for (const pair of match[1].split(";")) {
      const eq = pair.indexOf("=");
      if (eq > 0) fields[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    const w = parseNumber(fields, "w");
    const h = parseNumber(fields, "h");
    if (w <= 0 || h <= 0) throw new Error("sam: box token has a non-positive w or h");
    const x1 = parseNumber(fields, "x1");
    const y1 = parseNumber(fields, "y1");
    const x2 = parseNumber(fields, "x2");
    const y2 = parseNumber(fields, "y2");
    const score = parseNumber(fields, "c");
    if (score < 0 || score > 1) throw new Error("sam: box token score is outside 0-1");
    const box: Box = [
      Math.round((x1 / w) * 1000),
      Math.round((y1 / h) * 1000),
      Math.round((x2 / w) * 1000),
      Math.round((y2 / h) * 1000),
    ];
    if (box[0] > box[2] || box[1] > box[3]) {
      throw new Error("sam: box token has an inverted box");
    }
    instances.push({ score, box });
  }
  return instances;
}

export function createSamSegmentCaller(opts: SamClientOptions = {}): SamSegmentCaller {
  const apiKey = opts.apiKey ?? readEnv("MODEL_API_KEY") ?? readEnv("META_API_KEY");
  if (!apiKey) {
    throw new Error(
      "sam: no API key found. Set MODEL_API_KEY (or META_API_KEY) in the environment; the key is never committed or logged.",
    );
  }
  const baseUrl = (opts.baseUrl ?? readEnv("META_API_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const requestCost = opts.requestCostUsd ?? DEFAULT_REQUEST_COST_USD;
  // A bad per-request cost would only surface later, mid-run, when the
  // segment step records the call and the usage tracker rejects it.
  // Reject it here, at caller creation, like the tracker rejects bad
  // opts, so a misconfigured cost fails fast before any SAM call.
  if (!Number.isFinite(requestCost) || requestCost < 0) {
    throw new Error(`sam: requestCostUsd must be a finite number >= 0, got ${opts.requestCostUsd}`);
  }

  return async (req) => {
    const body: Record<string, unknown> = {
      model: req.model,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: req.concept },
            { type: "input_image", image_url: req.dataUrl },
          ],
        },
      ],
      metadata: { ...SAM_METADATA },
    };
    const started = Date.now();
    const res = await fetchImpl(`${baseUrl}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`sam: ${res.status} ${detail}`);
    }
    const parsed = (await res.json()) as Record<string, unknown>;
    const text = extractText(parsed);
    if (text === null) {
      throw new Error("sam: response had no text output");
    }
    return { instances: parseSamOutput(text), latencyMs, costUsd: requestCost };
  };
}
