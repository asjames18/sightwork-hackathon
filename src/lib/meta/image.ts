/**
 * SightWork Muse Image caller (renderAfter step).
 *
 * This is the caller the renderAfter step injects (see
 * src/lib/pipeline/renderAfter.ts): one hero-frame edit per request,
 * over the Meta Responses API. The step itself records every call on
 * the usage tracker, so the $10 spike cap is still enforced there.
 *
 * - Base URL: https://api.meta.ai/v1 (Responses API, POST /responses).
 *   Override with opts.baseUrl or the META_API_BASE_URL env var.
 * - Key: opts.apiKey, or MODEL_API_KEY, or META_API_KEY from the
 *   environment. The key is never logged, never stored, and never sent
 *   anywhere except the Authorization header of the Meta API call.
 * - This module makes no call on import. No call happens until a caller
 *   returned here is invoked, and tests inject a fake fetch instead.
 * - Shape is DOCS-LEVEL, not spike-verified (spike note, Oct 26):
 *   Spark, SAM and Image still return 404 model_not_found because the
 *   team's /v1/models list is empty; only Voice Transcribe is verified
 *   live. The shape below follows the spike note's Responses variant:
 *   an input_text instruction plus the hero frame as input_image, and
 *   one completed image_generation_call per image, whose result is
 *   base64. The live spike must confirm the tool shape and the billed
 *   price before this is trusted end to end.
 * - Model ID: muse-image-1.0 (spike note). The wiring supplies it;
 *   IMAGE_MODEL is exported for that wiring, not hardcoded in the step.
 * - Options (spike note): store:false so church frames are not kept
 *   for conversation state; size "1536x1024" for landscape frames;
 *   output_format "jpeg" so the returned data URL matches what the
 *   plan screen already renders (the provider default is webp).
 * - Cost: $0.01 per returned image, flat. Failed or safety-filtered
 *   images are free, so only completed calls are charged. When n > 1
 *   the caller makes one request per candidate and sums the cost;
 *   a short candidate list is returned, never padded with failures,
 *   and the renderAfter step picks the first good candidate when the
 *   judge path cannot run.
 * - Provider errors are surfaced verbatim (status + body) so a failing
 *   step fails loudly instead of guessing, per the step's rule.
 */

export interface ImageClientOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Injectable fetch for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** USD charged per returned image. Default: $0.01. */
  imageCostUsd?: number;
  /** Aspect-ratio size for the generation tool. Default: "1536x1024". */
  size?: string;
  /** Data-URL media type for returned images. Default: "jpeg". */
  outputFormat?: string;
}

/** One Muse Image edit request, matching renderAfter's ImageCaller. */
export interface ImageCaller {
  (req: {
    model: string;
    prompt: string;
    /** Data URL of the hero frame to edit. */
    image: string;
    /** Candidates wanted; 1 unless the wiring asks for 2. */
    n?: number;
  }): Promise<{ images: string[]; latencyMs: number; costUsd: number }>;
}

/** Muse Image model ID, confirmed in the spike note's docs pass. */
export const IMAGE_MODEL = "muse-image-1.0";

const DEFAULT_BASE_URL = "https://api.meta.ai/v1";
const DEFAULT_IMAGE_COST_USD = 0.01;
const DEFAULT_SIZE = "1536x1024";
const DEFAULT_OUTPUT_FORMAT = "jpeg";

function readEnv(name: string): string | undefined {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const v = env?.[name];
    return v && v.trim() ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pull completed image results out of a Responses body. Only items of
 * type image_generation_call with status "completed" and a non-empty
 * result count; failed or filtered calls are free and are skipped, not
 * treated as images. Anything else in output is ignored.
 */
export function parseImageResults(body: Record<string, unknown>, outputFormat: string): string[] {
  const output = body.output;
  if (!Array.isArray(output)) return [];
  const images: string[] = [];
  for (const item of output) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (rec.type !== "image_generation_call") continue;
    if (rec.status !== "completed") continue;
    const result = rec.result;
    if (typeof result !== "string" || result.length === 0) continue;
    images.push(`data:image/${outputFormat};base64,${result}`);
  }
  return images;
}

export function createImageCaller(opts: ImageClientOptions = {}): ImageCaller {
  const apiKey = opts.apiKey ?? readEnv("MODEL_API_KEY") ?? readEnv("META_API_KEY");
  if (!apiKey) {
    throw new Error(
      "image: no API key found. Set MODEL_API_KEY (or META_API_KEY) in the environment; the key is never committed or logged.",
    );
  }
  const baseUrl = (opts.baseUrl ?? readEnv("META_API_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const imageCost = opts.imageCostUsd ?? DEFAULT_IMAGE_COST_USD;
  // A bad per-image cost would only surface later, mid-run, when the
  // renderAfter step records the call and the usage tracker rejects
  // it. Reject it here, at caller creation, like the SAM caller does
  // for its per-request cost, so a misconfigured cost fails fast
  // before any Image call.
  if (!Number.isFinite(imageCost) || imageCost < 0) {
    throw new Error(`image: imageCostUsd must be a finite number >= 0, got ${opts.imageCostUsd}`);
  }
  const size = opts.size ?? DEFAULT_SIZE;
  const outputFormat = opts.outputFormat ?? DEFAULT_OUTPUT_FORMAT;

  return async (req) => {
    const wanted = req.n ?? 1;
    if (!Number.isInteger(wanted) || wanted < 1) {
      throw new Error(`image: n must be a positive integer, got ${String(req.n)}`);
    }
    const images: string[] = [];
    let latencyMs = 0;
    let costUsd = 0;
    for (let i = 0; i < wanted; i++) {
      const body: Record<string, unknown> = {
        model: req.model,
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: req.prompt },
              { type: "input_image", image_url: req.image },
            ],
          },
        ],
        tools: [{ type: "image_generation", size, output_format: outputFormat }],
        store: false,
      };
      const started = Date.now();
      const res = await fetchImpl(`${baseUrl}/responses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      latencyMs += Date.now() - started;
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`image: ${res.status} ${detail}`);
      }
      const parsed = (await res.json()) as Record<string, unknown>;
      const found = parseImageResults(parsed, outputFormat);
      // Only completed images are billed, per the spike note.
      costUsd += found.length * imageCost;
      images.push(...found);
    }
    if (images.length === 0) {
      throw new Error("image: response had no completed image");
    }
    return { images, latencyMs, costUsd };
  };
}
