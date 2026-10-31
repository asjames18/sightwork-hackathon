/**
 * The "how long will this take" line under the progress bar. Real runs on the live pipeline measured
 * about 2 to 3 minutes without a place and about 3 minutes with one (the live price lookup adds up to
 * a minute); the server stops a run at 5 minutes. The line changes as time passes so a slow run never
 * looks stuck. Example and mock runs keep the generic wording.
 */
export const RUN_LIMIT_MS = 300_000;
export const SLOW_AFTER_MS = 210_000;
export const NEAR_LIMIT_MS = 270_000;

export type RunTimeHint = { text: string; tone: "normal" | "slow" | "late" };

export function runTimeHint(elapsedMs: number, opts: { real: boolean; region?: string | null }): RunTimeHint {
  const ms = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  if (!opts.real) return { text: "Usually a few minutes.", tone: "normal" };
  if (ms >= NEAR_LIMIT_MS) {
    return { text: "Still working, close to the 5-minute limit. If it stops, Try again usually finishes.", tone: "late" };
  }
  if (ms >= SLOW_AFTER_MS) {
    return { text: "Taking a little longer than usual. It's still working.", tone: "slow" };
  }
  const place = opts.region?.trim();
  return {
    text: place ? `Usually about 3 minutes, including live prices for ${place}.` : "Usually 2 to 3 minutes.",
    tone: "normal",
  };
}
