/**
 * SightWork pipeline usage tracking.
 *
 * Every Meta Model API call the pipeline would make is recorded here:
 * model, pipeline step, latency, cost, and the running total against
 * both the $10 spike cap and the $150 Meta credit total. This module
 * makes no API calls itself; it only records what the pipeline reports.
 *
 * The spike cap is enforced in code: recording a call that would push
 * the spike total over SPIKE_CAP_USD throws, so a run stops instead of
 * silently overspending. For a full run after the spike, pass a higher
 * spikeCapUsd; the credit total is still tracked.
 */

export const SPIKE_CAP_USD = 10;
export const CREDIT_TOTAL_USD = 150;

/** One recorded (or would-be) model call. */
export interface UsageRecord {
  /** e.g. "muse-spark", "sam-3.1", "muse-image", "muse-voice-transcribe". */
  model: string;
  /** Pipeline step, e.g. "transcribe", "reason", "render-after". */
  step: string;
  /** Wall-clock latency of the call, milliseconds. */
  latencyMs: number;
  /** Estimated cost of the call, USD. */
  costUsd: number;
  /** ISO timestamp of when the call finished. */
  at: string;
}

/** Running totals for a run. */
export interface UsageTotals {
  calls: number;
  spikeTotalUsd: number;
  remainingSpikeUsd: number;
  remainingCreditUsd: number;
}

export interface UsageTracker {
  /** Record a call. Throws if the model, step, or supplied at is blank or unparseable, the cost is invalid, or the call would break the spike cap. */
  record(input: Omit<UsageRecord, "at"> & { at?: string }): UsageRecord;
  /** True when adding costUsd would stay within the spike cap. */
  canSpend(costUsd: number): boolean;
  totals(): UsageTotals;
  records(): readonly UsageRecord[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function createUsageTracker(opts?: {
  spikeCapUsd?: number;
  creditTotalUsd?: number;
}): UsageTracker {
  // A bad cap would silently break the spike accounting: a NaN cap
  // makes canSpend false and every record throw, a negative cap
  // throws on the first record with a misleading cap message, and a
  // bad credit total corrupts remainingCreditUsd. Reject bad opts
  // up front, at tracker creation, instead of at first record.
  if (
    opts?.spikeCapUsd !== undefined &&
    (!Number.isFinite(opts.spikeCapUsd) || opts.spikeCapUsd < 0)
  ) {
    throw new Error(`usage: spikeCapUsd must be a finite number >= 0, got ${opts.spikeCapUsd}`);
  }
  if (
    opts?.creditTotalUsd !== undefined &&
    (!Number.isFinite(opts.creditTotalUsd) || opts.creditTotalUsd < 0)
  ) {
    throw new Error(
      `usage: creditTotalUsd must be a finite number >= 0, got ${opts.creditTotalUsd}`,
    );
  }
  const spikeCapUsd = opts?.spikeCapUsd ?? SPIKE_CAP_USD;
  const creditTotalUsd = opts?.creditTotalUsd ?? CREDIT_TOTAL_USD;
  const seen: UsageRecord[] = [];
  let total = 0;

  return {
    record(input) {
      // Spike tracking attributes every call by model/step, so a
      // blank label would leave a server log line unattributable
      // and break per-model accounting against the $150 credits.
      if (typeof input.model !== "string" || input.model.trim().length === 0) {
        throw new Error(`usage: model must be a non-empty string, got ${JSON.stringify(input.model)}`);
      }
      if (typeof input.step !== "string" || input.step.trim().length === 0) {
        throw new Error(`usage: step must be a non-empty string, got ${JSON.stringify(input.step)}`);
      }
      // A caller-supplied timestamp is stored verbatim in the spike
      // log, so a blank, non-string, or unparseable at would leave a
      // log line undated (or unsortable) and break ordering against
      // the $150 credits. Omitted at still defaults to now; only a
      // supplied value is checked.
      if (
        input.at !== undefined &&
        (typeof input.at !== "string" ||
          input.at.trim().length === 0 ||
          Number.isNaN(Date.parse(input.at)))
      ) {
        throw new Error(`usage: at must be a parseable date string when supplied, got ${JSON.stringify(input.at)}`);
      }
      if (!Number.isFinite(input.costUsd) || input.costUsd < 0) {
        throw new Error(`usage: costUsd must be a finite number >= 0, got ${input.costUsd}`);
      }
      if (!Number.isFinite(input.latencyMs) || input.latencyMs < 0) {
        throw new Error(`usage: latencyMs must be a finite number >= 0, got ${input.latencyMs}`);
      }
      if (round2(total + input.costUsd) > spikeCapUsd) {
        throw new Error(
          `usage: spike cap $${spikeCapUsd} would be exceeded ` +
            `($${round2(total)} spent + $${round2(input.costUsd)} for ${input.model}/${input.step})`,
        );
      }
      const rec: UsageRecord = {
        model: input.model,
        step: input.step,
        latencyMs: input.latencyMs,
        costUsd: round2(input.costUsd),
        at: input.at ?? new Date().toISOString(),
      };
      seen.push(rec);
      total = round2(total + rec.costUsd);
      // A copy, not the live log entry: a caller mutating the
      // returned record must not rewrite the spike log line.
      return { ...rec };
    },
    canSpend(costUsd: number): boolean {
      return Number.isFinite(costUsd) && costUsd >= 0 && round2(total + costUsd) <= spikeCapUsd;
    },
    totals(): UsageTotals {
      return {
        calls: seen.length,
        spikeTotalUsd: total,
        remainingSpikeUsd: round2(spikeCapUsd - total),
        remainingCreditUsd: round2(creditTotalUsd - total),
      };
    },
    records(): readonly UsageRecord[] {
      // Copies of the log and of each entry, not the live array or
      // live entries: a caller pushing to (or splicing) the returned
      // array, or mutating a returned record, must not change the
      // tracker's own record count, the order the spike log is
      // printed in, or the logged cost of a call.
      return seen.map((r) => ({ ...r }));
    },
  };
}
