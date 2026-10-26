/**
 * SightWork Meta client (Muse Spark via the Meta Model API).
 *
 * This is the caller the pipeline steps inject (see src/lib/pipeline):
 * `reason.ts` calls it with frames attached, `cost.ts` calls it with the
 * web_search tool for grounded prices. The steps themselves record every
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

  return {
    async callSpark(req: SparkCallRequest): Promise<SparkCallResult> {
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
