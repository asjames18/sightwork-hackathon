// "Wide view" on the in-page camera. Some phones expose their ultra-wide lens as a zoom below 1x on
// the video track; when they do, the recorder offers a toggle so one pass takes in more of the room.
// Everywhere else (no zoom, or no zoom below 1x) the recorder simply shows no button.

/** The bits of a video track this file uses, so tests can pass a plain object. */
export interface ZoomTrack {
  readyState?: string;
  getCapabilities?: () => unknown;
  getSettings?: () => unknown;
  applyConstraints?: (c: MediaTrackConstraints) => Promise<void>;
}

/** Zoom range the track reports, or null when it has none we can use. */
export interface ZoomRange {
  min: number;
  max: number;
  /** The zoom the camera opened at (usually 1). */
  normal: number;
}

/** Wide view is only worth a button when the camera can go at least this far below its normal zoom. */
const MIN_WIDE_GAIN = 0.1;

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** The track's zoom range when it can zoom out wider than it opened, otherwise null. */
export function wideZoomRange(track: ZoomTrack | null | undefined): ZoomRange | null {
  if (!track || track.readyState === "ended") return null;
  if (typeof track.getCapabilities !== "function" || typeof track.applyConstraints !== "function") return null;
  try {
    const caps = track.getCapabilities() as { zoom?: { min?: unknown; max?: unknown } } | null | undefined;
    const min = caps?.zoom?.min;
    const max = caps?.zoom?.max;
    if (!finite(min) || !finite(max) || max < min) return null;
    let normal = 1;
    try {
      const s = typeof track.getSettings === "function" ? (track.getSettings() as { zoom?: unknown } | null) : null;
      if (finite(s?.zoom)) normal = s!.zoom as number;
    } catch {
      // keep 1
    }
    normal = Math.min(Math.max(normal, min), max);
    if (normal - min < MIN_WIDE_GAIN) return null;
    return { min, max, normal };
  } catch {
    return null;
  }
}

/**
 * Switches wide view on or off. Resolves to the state the camera is in afterwards: the asked-for
 * state when the phone accepted it, otherwise the opposite (so the button never lies).
 */
export async function setWideView(track: ZoomTrack | null | undefined, wide: boolean): Promise<boolean> {
  const range = wideZoomRange(track);
  if (!range) return false;
  try {
    await track!.applyConstraints!({ advanced: [{ zoom: wide ? range.min : range.normal } as MediaTrackConstraintSet] });
    return wide;
  } catch {
    return !wide;
  }
}

/** Button text: what tapping it does. Read by screen readers together with aria-pressed. */
export function wideButtonLabel(wide: boolean): string {
  return wide ? "Normal view" : "Wide view";
}

/** Short zoom tag for the button, e.g. "0.5x", so people recognise the phone's own wide lens. */
export function wideZoomTag(range: ZoomRange | null): string | null {
  if (!range) return null;
  const v = Math.round(range.min * 10) / 10;
  return `${v}x`;
}
