/**
 * Orientation tip for the picked walkthrough, shown on the upload card before anything is sent. A phone held
 * upright sees a narrow slice of a wide room, so stage edges, rows of chairs and far walls get cut off in
 * every frame; held sideways it fits much more of the room in each picture. The tip is a soft note, never a
 * block, and it stays quiet for small rooms where upright is fine. Pure logic, no DOM, no network.
 */
import type { RoomSize } from "./duration";

/** Height must be at least this many times the width before a take counts as upright. */
export const UPRIGHT_RATIO = 1.15;

export const SIDEWAYS_TIP =
  "This video was filmed upright. For a room this size, holding the phone sideways fits more of the room in each frame, so less gets cut off. You can still go ahead with this one.";

/** True when the picture is clearly taller than wide. Unknown or odd sizes count as not upright. */
export function isUpright(width: number | null | undefined, height: number | null | undefined): boolean {
  if (typeof width !== "number" || typeof height !== "number") return false;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  return height >= width * UPRIGHT_RATIO;
}

/** The tip for an upright take in a medium, large or extra large room, otherwise null. */
export function sidewaysTip(
  width: number | null | undefined,
  height: number | null | undefined,
  size?: RoomSize | string | null,
): string | null {
  if (size === "small") return null;
  return isUpright(width, height) ? SIDEWAYS_TIP : null;
}
