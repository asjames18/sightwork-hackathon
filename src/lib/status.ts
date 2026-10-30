/**
 * Status page facts, read from the server environment. Presence only: no key, code or URL value ever leaves
 * this function. No network and no model calls, so /status costs nothing and can be checked any time.
 */
import { EXAMPLES } from "./examples";
import { planEngine } from "./metaCredits";

export type StatusLevel = "ok" | "off" | "warn";

export interface StatusRow {
  name: string;
  level: StatusLevel;
  detail: string;
}

export interface SiteStatus {
  /** Short commit of this build, or null for a local build. */
  commit: string | null;
  /** Deployment environment name ("production", "preview", or "local"). */
  environment: string;
  planEngine: string;
  rows: StatusRow[];
  /** Hardening that is always on in this build (static facts from the code, kept next to the code they describe). */
  safeguards: string[];
}

type Env = Record<string, string | undefined>;

const has = (env: Env, ...names: string[]) => names.some((n) => Boolean(env[n]?.trim()));

export function siteStatus(env: Env): SiteStatus {
  const provider = env.PLAN_PROVIDER?.trim().toLowerCase() === "meta" ? "meta" : "baseten";
  const engine = planEngine(provider);
  const metaKey = has(env, "MODEL_API_KEY", "META_API_KEY");
  const basetenKey = has(env, "BASETEN_API_KEY");
  const gate = has(env, "SIGHTWORK_TEST_CODE");
  const planReady = provider === "baseten" ? basetenKey : metaKey;
  const real = EXAMPLES.filter((e) => e.kind === "real").length;

  const rows: StatusRow[] = [
    { name: "Site and example plans", level: "ok", detail: `${EXAMPLES.length} example plans built in (${real} real run), no keys needed` },
    {
      name: "Real runs",
      level: gate ? "ok" : "off",
      detail: gate ? "On for testers: each run needs a tester code" : "Switched off on this server (no tester code set), so nothing can spend credits",
    },
    {
      name: `Plan engine: ${engine.model}`,
      level: planReady ? "ok" : "warn",
      detail: planReady ? `${engine.host}, configured` : `${engine.host}, not configured on this server`,
    },
    {
      name: "Meta Model API: Muse Voice Transcribe, SAM 3.1, Muse Image",
      level: metaKey ? "ok" : "warn",
      detail: metaKey ? "Configured. Optional steps skip cleanly if a model is briefly unavailable" : "Not configured on this server",
    },
  ];

  return {
    commit: env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 7) || null,
    environment: env.VERCEL_ENV?.trim() || "local",
    planEngine: `${engine.model} (${engine.host})`,
    rows,
    safeguards: [
      "Tester-code gate on every API request, compared in constant time, fail closed",
      "Plan model retries brief gateway errors (502, 503, 504) up to 3 times with backoff; a failed call spends nothing",
      "Meta model_not_found blips get a short backoff and retry",
      "Outlines, counts and the after picture are optional: if one fails, the plan still finishes and says what was skipped",
      "Per-run spend cap enforced before every model call",
      "Size caps on frames and audio checked on the device and again on the server, before any call",
      "A reviewer pass checks every problem against its proof photo and never edits the plan",
      "One log line per allowed real run for the spend tally",
    ],
  };
}
