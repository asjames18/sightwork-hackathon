/**
 * Small count shown on a sticky plan section chip ("Problems 7"), so the size of each part of the plan shows at a
 * glance before scrolling to it. Nothing for an empty or unknown section, and very long lists stop at "99+" so the
 * chip stays narrow on a phone.
 */
export function chipCount(n: number | undefined | null): string | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const whole = Math.floor(n);
  if (whole <= 0) return null;
  return whole > 99 ? "99+" : String(whole);
}

/** What a section chip tracks once the reader starts ticking things off. */
export type ChipTrack = "steps" | "materials";

/**
 * Progress shown on the Steps or Materials chip once something is ticked ("3/8"), so the sticky row says how far the
 * work has come without scrolling. Null before any tick or for an empty section, so the plain count shows instead.
 * `spoken` replaces the "3/8" text for screen readers ("3 of 8 done").
 */
export function chipProgress(
  done: number | undefined | null,
  total: number | undefined | null,
  track: ChipTrack,
): { text: string; spoken: string; complete: boolean } | null {
  if (typeof done !== "number" || typeof total !== "number" || !Number.isFinite(done) || !Number.isFinite(total)) return null;
  const all = Math.floor(total);
  const got = Math.min(Math.floor(done), all);
  if (all <= 0 || got <= 0) return null;
  const word = track === "steps" ? "done" : "in hand";
  const big = (n: number) => (n > 99 ? "99+" : String(n));
  return {
    text: `${big(got)}/${big(all)}`,
    spoken: got === all ? `all ${all} ${word}` : `${got} of ${all} ${word}`,
    complete: got === all,
  };
}
