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
