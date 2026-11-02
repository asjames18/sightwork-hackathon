/**
 * The still shown next to a saved take: its own video, paused a moment in, so takes filmed back to
 * back are easy to tell apart. A media fragment (#t=) makes browsers, iPhone Safari included, paint
 * that frame instead of a blank box once the metadata loads.
 */
export const THUMB_AT_SEC = 0.5;

/** The time to show, in seconds: half a second in, or the middle of a very short take. */
export function takeThumbTime(durationSec: number | null | undefined): number {
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec <= 0) return THUMB_AT_SEC;
  return Math.min(THUMB_AT_SEC, Math.round((durationSec / 2) * 100) / 100);
}

/** The video source for the still: the object URL plus a #t= fragment. Empty when there's no URL. */
export function takeThumbSrc(url: string | null | undefined, durationSec?: number | null): string {
  if (typeof url !== "string" || !url) return "";
  const base = url.split("#")[0];
  return `${base}#t=${takeThumbTime(durationSec)}`;
}
