/**
 * SightWork Baseten caller (Muse Spark Open, the main plan engine).
 *
 * Per Antonio's Oct 27 decision, the reason step's main engine is
 * Muse Spark Open on Baseten; Meta SAM 3.1 / Muse Image stay optional
 * steps that skip cleanly when Meta is blocked. This module is the
 * Baseten counterpart of ./client.ts (the Meta caller): same request /
 * result shape, so the pipeline steps can swap providers without
 * changing step logic. The route picks the provider later
 * (PLAN_PROVIDER=baseten|meta); this module only makes the call.
 *
 * - Base URL: https://inference.baseten.co/v1 (OpenAI-compatible
 *   Chat Completions, POST /chat/completions). Override with
 *   opts.baseUrl or the BASETEN_API_BASE_URL env var.
 * - Model: exactly "meta-models/muse-spark-open-1026". The hackathon
 *   key works with this model only (the docs' bare
 *   "meta-models/muse-spark-open" name is NOT the hackathon model), so
 *   the caller always uses its configured model and ignores any model
 *   name passed on a request.
 * - Key: opts.apiKey, or BASETEN_API_KEY from the environment. The key
 *   is never logged, never stored, and never sent anywhere except the
 *   Authorization header of the Baseten call.
 * - This module makes no call on import. No call happens until a caller
 *   returned here is invoked, and tests inject a fake fetch instead.
 * - Provider limits that shape this caller (spike notes, Oct 27):
 *   at most 8 images per request; the JSON schema is NOT enforced
 *   server-side, so the schema is appended to the prompt text, the
 *   reasoning lane (returned separately from message.content) is
 *   ignored, code fences are stripped, and the parsed content is
 *   returned for the step's own validation + one retry.
 * - Cost: computed from the response's usage tokens at $1.25/M input
 *   and $4.25/M output (spike-measured: 8,812 in / 2,805 out = $0.0229).
 *   Provider errors are surfaced verbatim (status + body) so a failing
 *   step fails loudly instead of guessing.
 */

export interface BasetenClientOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Injectable fetch for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Fixed model for every call. Default: the hackathon model below. */
  model?: string;
  /** USD per 1M input tokens. Default: Baseten Muse Spark Open pricing. */
  inputPricePerMillion?: number;
  /** USD per 1M output tokens. Default: Baseten Muse Spark Open pricing. */
  outputPricePerMillion?: number;
}

export interface BasetenCallRequest {
  /** Ignored: the caller always uses its configured model (see header). */
  model: string;
  prompt: string;
  /** Data URLs, attached in order (reason step). At most 8. */
  images?: string[];
  /** JSON schema, appended to the prompt (not enforced server-side). */
  schema: Record<string, unknown>;
}

export interface BasetenCallResult {
  json: unknown;
  latencyMs: number;
  costUsd: number;
  /** Model actually used for the call (the configured model). */
  model: string;
}

export interface BasetenClient {
  /** One Chat Completions call. Returns parsed JSON, latency, cost, and the model used. */
  callSpark(req: BasetenCallRequest): Promise<BasetenCallResult>;
}

const DEFAULT_BASE_URL = "https://inference.baseten.co/v1";
const BASETEN_MODEL = "meta-models/muse-spark-open-1026";
const MAX_IMAGES_PER_REQUEST = 8;
const DEFAULT_INPUT_PRICE_PER_MILLION = 1.25;
const DEFAULT_OUTPUT_PRICE_PER_MILLION = 4.25;

function readEnv(name: string): string | undefined {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const v = env?.[name];
    return v && v.trim() ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Strip a surrounding ``` or ```json fence; plain text passes through. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const lines = trimmed.split("\n");
  lines.shift();
  if (lines.length > 0 && lines[lines.length - 1].trim() === "```") lines.pop();
  return lines.join("\n").trim();
}

export function createBasetenClient(opts: BasetenClientOptions = {}): BasetenClient {
  const apiKey = opts.apiKey ?? readEnv("BASETEN_API_KEY");
  if (!apiKey) {
    throw new Error(
      "baseten: no API key found. Set BASETEN_API_KEY in the environment; the key is never committed or logged.",
    );
  }
  const baseUrl = (opts.baseUrl ?? readEnv("BASETEN_API_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = opts.model ?? BASETEN_MODEL;
  // A blank or non-string configured model would otherwise be sent to
  // Baseten and only fail at the provider, spending a paid call: the
  // request's model is deliberately ignored (this caller always uses
  // its configured model), so the configured model is the one that
  // must be checked. Reject it here, at caller creation, like the
  // token prices below, so a misconfigured model fails fast before
  // any Baseten call. The default hackathon model is unchanged.
  if (typeof model !== "string" || model.trim().length === 0) {
    throw new Error(`baseten: model must be a non-empty string, got ${JSON.stringify(opts.model)}`);
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const inputPrice = opts.inputPricePerMillion ?? DEFAULT_INPUT_PRICE_PER_MILLION;
  const outputPrice = opts.outputPricePerMillion ?? DEFAULT_OUTPUT_PRICE_PER_MILLION;
  if (!Number.isFinite(inputPrice) || inputPrice < 0) {
    throw new Error(
      `baseten: inputPricePerMillion must be a finite number >= 0, got ${opts.inputPricePerMillion}`,
    );
  }
  if (!Number.isFinite(outputPrice) || outputPrice < 0) {
    throw new Error(
      `baseten: outputPricePerMillion must be a finite number >= 0, got ${opts.outputPricePerMillion}`,
    );
  }

  return {
    async callSpark(req: BasetenCallRequest): Promise<BasetenCallResult> {
      // A bad request would otherwise spend a paid Baseten call and only
      // fail downstream, when the step parses an empty or garbage
      // result. Reject it here, before any fetch, mirroring the Meta
      // caller's request-field validation. The request's model is
      // deliberately not checked: this caller always uses its
      // configured model and ignores any model name on the request.
      if (typeof req.prompt !== "string" || req.prompt.trim().length === 0) {
        throw new Error("baseten: prompt must be a non-empty string");
      }
      if (
        req.images !== undefined &&
        (!Array.isArray(req.images) ||
          req.images.some((image) => typeof image !== "string" || image.trim().length === 0))
      ) {
        throw new Error("baseten: images must be an array of non-empty strings");
      }
      if (req.schema === null || typeof req.schema !== "object" || Array.isArray(req.schema)) {
        throw new Error("baseten: schema must be an object");
      }
      const images = req.images ?? [];
      if (images.length > MAX_IMAGES_PER_REQUEST) {
        throw new Error(
          `baseten: at most ${MAX_IMAGES_PER_REQUEST} images per request, got ${images.length}`,
        );
      }
      const content: Record<string, unknown>[] = [
        {
          type: "text",
          // Schema is not enforced server-side: it rides in the prompt
          // and the step validates the parsed JSON itself.
          text:
            `${req.prompt}\n\nReturn only a JSON object matching this JSON schema, with no other text:\n${JSON.stringify(req.schema)}`,
        },
      ];
      for (const image of images) {
        content.push({ type: "image_url", image_url: { url: image } });
      }
      const body: Record<string, unknown> = {
        model,
        messages: [{ role: "user", content }],
      };

      const started = Date.now();
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const latencyMs = Date.now() - started;

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`baseten: ${res.status} ${detail}`);
      }
      const parsed = (await res.json()) as Record<string, unknown>;
      const choices = parsed.choices;
      if (!Array.isArray(choices) || choices.length === 0) {
        throw new Error("baseten: response had no choices");
      }
      const message = (choices[0] as Record<string, unknown>).message as
        | Record<string, unknown>
        | undefined;
      // Reasoning arrives in its own lane (e.g. reasoning_content); only
      // message.content is the answer, and only that is parsed.
      const text = message?.content;
      if (typeof text !== "string") {
        throw new Error("baseten: response message had no text content");
      }
      let json: unknown;
      try {
        json = JSON.parse(stripCodeFences(text));
      } catch {
        throw new Error(`baseten: response text was not JSON: ${text.slice(0, 200)}`);
      }
      const usage = (parsed.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number };
      // Mirror the Meta caller: a bad provider token count must fail
      // fast here, at the cost computation, not later as a generic
      // usage-tracker cost rejection. A missing field still means
      // zero tokens, as before.
      for (const [field, value] of [
        ["prompt_tokens", usage.prompt_tokens],
        ["completion_tokens", usage.completion_tokens],
      ] as const) {
        if (
          value !== undefined &&
          (typeof value !== "number" || !Number.isInteger(value) || value < 0)
        ) {
          throw new Error(`baseten: usage ${field} must be an integer >= 0`);
        }
      }
      const inputTokens = usage.prompt_tokens ?? 0;
      const outputTokens = usage.completion_tokens ?? 0;
      const costUsd = (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
      return { json, latencyMs, costUsd, model };
    },
  };
}

/** Adapter for the reason step's SparkCaller (frames attached). */
export function createReasonBasetenCaller(client: BasetenClient) {
  return (req: { model: string; prompt: string; images: string[]; schema: Record<string, unknown> }) =>
    client.callSpark({ model: req.model, prompt: req.prompt, images: req.images, schema: req.schema });
}
