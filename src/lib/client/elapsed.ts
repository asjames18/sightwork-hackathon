/**
 * Time helpers for the processing screen: a running clock ("1:23") and how long each finished step
 * took ("12 s", "1 min 5 s"). Pure functions, so the screen and the tests share one source.
 */

/** Clock text for a running total: m:ss, or h:mm:ss past an hour. Negative or bad input reads 0:00. */
export function formatClock(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Spoken form of the same clock, for screen readers ("1 minute 23 seconds"). */
export function spokenClock(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (m === 0) return part(s, "second");
  return s === 0 ? part(m, "minute") : `${part(m, "minute")} ${part(s, "second")}`;
}

/** How long a finished step took, rounded to whole seconds. Under a second returns null (not worth showing). */
export function formatStepTime(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 1000) return null;
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/**
 * Step timing state. `marks[i]` is when step i finished. Moving forward stamps every step passed;
 * moving back (a retry that starts over) or a restart after a failure begins a fresh clock.
 */
export type StepClock = { start: number; marks: number[]; seen: number };

export function startClock(now: number, current = 0): StepClock {
  return { start: now, marks: [], seen: current };
}

export function advanceClock(clock: StepClock, current: number, now: number, restarted = false): StepClock {
  if (restarted || current < clock.seen) return startClock(now, current);
  if (current === clock.seen) return clock;
  const marks = clock.marks.slice();
  for (let i = clock.seen; i < current; i++) marks[i] = now;
  return { ...clock, marks, seen: current };
}

/** How long step i took, or null when it hasn't finished. */
export function stepDuration(clock: StepClock, i: number): number | null {
  const end = clock.marks[i];
  if (end === undefined) return null;
  const begin = i === 0 ? clock.start : (clock.marks[i - 1] ?? clock.start);
  return end - begin;
}
