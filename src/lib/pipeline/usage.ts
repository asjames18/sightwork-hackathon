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
  /** Record a call. Throws if the cost is invalid or would break the spike cap. */
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
  const spikeCapUsd = opts?.spikeCapUsd ?? SPIKE_CAP_USD;
  const creditTotalUsd = opts?.creditTotalUsd ?? CREDIT_TOTAL_USD;
  const seen: UsageRecord[] = [];
  let total = 0;

  return {
    record(input) {
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
      return rec;
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
      return seen;
    },
  };
}
