/**
 * Length check for the picked walkthrough video, shown on the upload screen. Pure (no browser APIs),
 * so tools/test can check it.
 */

/** Walkthroughs work best at 60 to 90 seconds; past this we warn, past the hard limit we block. */
export const SOFT_MAX_SEC = 95;
export const HARD_MAX_SEC = 150;
export const MIN_SEC = 5;

export type Check =
  | { kind: "reading" }
  | { kind: "ok"; durationSec: number }
  | { kind: "warn"; durationSec: number; message: string }
  | { kind: "block"; message: string };

/** Plain-language verdict on a picked video's length. Pure, so it can be checked without a browser. */
export function checkDuration(durationSec: number): Check {
  if (!Number.isFinite(durationSec) || durationSec <= 0)
    return { kind: "block", message: "We couldn't read this video's length. Try recording again, or pick an MP4." };
  if (durationSec < MIN_SEC)
    return { kind: "block", message: "That clip is only a few seconds. Walk the whole space for 60 to 90 seconds." };
  if (durationSec > HARD_MAX_SEC)
    return { kind: "block", message: "That video is over 2½ minutes. Trim it to about 90 seconds, or record a shorter walkthrough." };
  if (durationSec > SOFT_MAX_SEC)
    return { kind: "warn", durationSec, message: "A bit long. It will still work, but 60 to 90 seconds gives the sharpest plan." };
  return { kind: "ok", durationSec };
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
