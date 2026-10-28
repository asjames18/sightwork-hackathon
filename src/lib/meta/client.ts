/**
 * SightWork Meta client (Muse Spark via the Meta Model API).
 *
 * This is the caller the pipeline steps inject (see src/lib/pipeline):
 * `reason.ts` calls it with frames attached, `cost.ts` calls it with the
 * web_search tool for grounded prices, and `renderAfter.ts` calls it for
 * the generate-2-keep-1 judge (original + two candidates, in order). The steps themselves record every
 * call on the usage tracker, so the $10 spike cap is still enforced there.
 *
 * - Base URL: https://api.meta.ai/v1 (Responses API, POST /responses).
 *   Override with opts.baseUrl or the META_API_BASE_URL env var.
 * - Key: opts.apiKey, or MODEL_API_KEY, or META_API_KEY from the
 *   environment. The key is never logged, never stored, and never sent
 *   anywhere except the Authorization header of the Meta API call.
 * - This module makes no call on import. No call happens until a caller
 *   returned here is invoked, and tests inject a fake fetch instead.
 * - Provider errors are surfaced verbatim (status + body) so a failing
 *   step fails loudly instead of guessing, per the reason step's rule.
 * - Cost: computed from the response's usage tokens at the standard-tier
 *   rates below, which the spike wiring may override via opts. When the
 *   web_search tool is used, one search query is charged by default
 *   ($2.50 per 1,000 queries); the wiring may override that too once
 *   the provider reports a real search count.
 */

export interface MetaUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export interface MetaClientOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Injectable fetch for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** USD per 1M input tokens. Default: standard-tier Spark pricing. */
  inputPricePerMillion?: number;
  /** USD per 1M output tokens. Default: standard-tier Spark pricing. */
  outputPricePerMillion?: number;
  /** USD charged per web_search call. Default: one query at $2.50/1,000. */
  webSearchCostUsd?: number;
}

export interface SparkCallRequest {
  model: string;
  prompt: string;
  /** Data URLs, attached in order (reason step). Omit for text-only calls. */
  images?: string[];
  /** Structured-output JSON schema (prompt 03 / 05, owned by Grok Bot). */
  schema: Record<string, unknown>;
  /** Tool list, e.g. [{ type: "web_search" }] for the cost step. */
  tools?: { type: string }[];
}

export interface SparkCallResult {
  json: unknown;
  latencyMs: number;
  costUsd: number;
}

export interface MetaClient {
  /** One Responses API call. Returns parsed JSON, latency, and cost. */
  callSpark(req: SparkCallRequest): Promise<SparkCallResult>;
}

const DEFAULT_BASE_URL = "https://api.meta.ai/v1";
const DEFAULT_INPUT_PRICE_PER_MILLION = 1.25;
const DEFAULT_OUTPUT_PRICE_PER_MILLION = 4.25;
const DEFAULT_WEB_SEARCH_COST_USD = 0.0025;

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

export function createMetaClient(opts: MetaClientOptions = {}): MetaClient {
  const apiKey = opts.apiKey ?? readEnv("MODEL_API_KEY") ?? readEnv("META_API_KEY");
  if (!apiKey) {
    throw new Error(
      "meta: no API key found. Set MODEL_API_KEY (or META_API_KEY) in the environment; the key is never committed or logged.",
    );
  }
  const baseUrl = (opts.baseUrl ?? readEnv("META_API_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const inputPrice = opts.inputPricePerMillion ?? DEFAULT_INPUT_PRICE_PER_MILLION;
  const outputPrice = opts.outputPricePerMillion ?? DEFAULT_OUTPUT_PRICE_PER_MILLION;
  const webSearchCost = opts.webSearchCostUsd ?? DEFAULT_WEB_SEARCH_COST_USD;
  if (!Number.isFinite(inputPrice) || inputPrice < 0) {
    throw new Error(
      `meta: inputPricePerMillion must be a finite number >= 0, got ${opts.inputPricePerMillion}`,
    );
  }
  if (!Number.isFinite(outputPrice) || outputPrice < 0) {
    throw new Error(
      `meta: outputPricePerMillion must be a finite number >= 0, got ${opts.outputPricePerMillion}`,
    );
  }
  if (!Number.isFinite(webSearchCost) || webSearchCost < 0) {
    throw new Error(
      `meta: webSearchCostUsd must be a finite number >= 0, got ${opts.webSearchCostUsd}`,
    );
  }

  return {
    async callSpark(req: SparkCallRequest): Promise<SparkCallResult> {
      // A bad request would otherwise spend a paid Spark call and only
      // fail downstream, when the step parses an empty or garbage
      // result. Reject it here, before any fetch, like the SAM, Image,
      // and ASR callers do for their request fields.
      if (typeof req.model !== "string" || req.model.trim().length === 0) {
        throw new Error("meta: model must be a non-empty string");
      }
      if (typeof req.prompt !== "string" || req.prompt.trim().length === 0) {
        throw new Error("meta: prompt must be a non-empty string");
      }
      if (
        req.images !== undefined &&
        (!Array.isArray(req.images) ||
          req.images.some((image) => typeof image !== "string" || image.trim().length === 0))
      ) {
        throw new Error("meta: images must be an array of non-empty strings");
      }
      if (req.schema === null || typeof req.schema !== "object" || Array.isArray(req.schema)) {
        throw new Error("meta: schema must be an object");
      }
      if (
        req.tools !== undefined &&
        (!Array.isArray(req.tools) ||
          req.tools.some(
            (tool) =>
              tool === null ||
              typeof tool !== "object" ||
              typeof tool.type !== "string" ||
              tool.type.trim().length === 0,
          ))
      ) {
        throw new Error("meta: tools must be an array of { type: non-empty string }");
      }
      const content: Record<string, unknown>[] = [{ type: "input_text", text: req.prompt }];
      for (const image of req.images ?? []) {
        content.push({ type: "input_image", image_url: image });
      }
      const body: Record<string, unknown> = {
        model: req.model,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "sightwork", schema: req.schema, strict: true } },
        ...(req.tools && req.tools.length > 0 ? { tools: req.tools } : {}),
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
        throw new Error(`meta: ${res.status} ${detail}`);
      }
      const parsed = (await res.json()) as Record<string, unknown>;
      const text = extractText(parsed);
      if (text === null) {
        throw new Error("meta: response had no text output");
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`meta: response text was not JSON: ${text.slice(0, 200)}`);
      }
      const usage = (parsed.usage ?? {}) as MetaUsage;
      // A bad provider token count would otherwise flow into the
      // cost math unchecked and only surface later, mid-run, when
      // the step records the call and the usage tracker rejects the
      // resulting negative (or non-finite) cost with a generic cost
      // message. Token counts are whole counts, so reject a
      // non-integer, negative, or non-finite count here, at the cost
      // computation, like the ASR caller rejects a bad duration.
      // A missing field still means zero tokens, as before.
      for (const [field, value] of [
        ["input_tokens", usage.input_tokens],
        ["output_tokens", usage.output_tokens],
      ] as const) {
        if (
          value !== undefined &&
          (typeof value !== "number" || !Number.isInteger(value) || value < 0)
        ) {
          throw new Error(`meta: usage ${field} must be an integer >= 0, got ${value}`);
        }
      }
      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;
      const tokenCost = (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
      const searchCost = (req.tools ?? []).some((t) => t.type === "web_search") ? webSearchCost : 0;
      return { json, latencyMs, costUsd: tokenCost + searchCost };
    },
  };
}

/** Adapter for the reason step's SparkCaller (frames attached). */
export function createReasonSparkCaller(client: MetaClient) {
  return (req: { model: string; prompt: string; images: string[]; schema: Record<string, unknown> }) =>
    client.callSpark({ model: req.model, prompt: req.prompt, images: req.images, schema: req.schema });
}

/** Adapter for the cost step's CostCaller (text-only, web_search tool). */
export function createCostSparkCaller(client: MetaClient) {
  return (req: { model: string; prompt: string; schema: Record<string, unknown> }) =>
    client.callSpark({ model: req.model, prompt: req.prompt, schema: req.schema, tools: [{ type: "web_search" }] });
}

/**
 * Judge schema for the renderAfter generate-2-keep-1 path (prompt 04's
 * judge prompt). The judge answers {"pick": 2 or 3, "reason": "..."}; the
 * step keeps the first candidate on any other answer, so the schema pins
 * pick to 2 or 3 and requires the reason.
 */
const JUDGE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    pick: { type: "integer", enum: [2, 3] },
    reason: { type: "string" },
  },
  required: ["pick", "reason"],
  additionalProperties: false,
};

/** Adapter for the renderAfter step's JudgeCaller (original + 2 candidates, in order). */
export function createJudgeSparkCaller(client: MetaClient) {
  return (req: { model: string; prompt: string; images: [string, string, string] }) =>
    client.callSpark({
      model: req.model,
      prompt: req.prompt,
      images: [...req.images],
      schema: JUDGE_SCHEMA,
    });
}
