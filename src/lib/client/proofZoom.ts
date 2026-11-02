import { canToggleOutline } from "./outlineToggle";

/**
 * "Zoom in" on the full-size proof photo. On a phone the problem is often a small part of the frame (a
 * loose cable, a scuff), so zooming enlarges the photo around the outline and centers it, without ever
 * showing empty space past the photo's edges. With no usable box it zooms 2x on the middle.
 */
export interface ProofZoom {
  /** How many times larger, 1.5 to 4 in half steps. */
  scale: number;
  /** The point (percent of the photo) that ends up in the middle of the view. */
  centerX: number;
  centerY: number;
}

export const ZOOM_MIN = 1.5;
export const ZOOM_MAX = 4;
const FILL = 700; // the box's longer side fills about 70% of the view after zooming

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function proofZoom(box: unknown): ProofZoom {
  if (!canToggleOutline(box)) return { scale: 2, centerX: 50, centerY: 50 };
  const [x1, y1, x2, y2] = box as [number, number, number, number];
  const left = clamp(Math.min(x1, x2), 0, 1000);
  const right = clamp(Math.max(x1, x2), 0, 1000);
  const top = clamp(Math.min(y1, y2), 0, 1000);
  const bottom = clamp(Math.max(y1, y2), 0, 1000);
  const side = Math.max(right - left, bottom - top, 1);
  const scale = clamp(Math.floor((FILL / side) * 2) / 2, ZOOM_MIN, ZOOM_MAX);
  // Keep the view inside the photo: the middle can't sit closer than half a view to an edge.
  const half = 50 / scale;
  const centerX = clamp((left + right) / 20, half, 100 - half);
  const centerY = clamp((top + bottom) / 20, half, 100 - half);
  return { scale, centerX: Math.round(centerX * 100) / 100, centerY: Math.round(centerY * 100) / 100 };
}

/** CSS for the zoomed layer: scale around the chosen point, then move that point to the middle. */
export function proofZoomStyle(z: ProofZoom): { transform: string; transformOrigin: string } {
  return {
    transformOrigin: `${z.centerX}% ${z.centerY}%`,
    transform: `translate(${Math.round((50 - z.centerX) * 100) / 100}%, ${Math.round((50 - z.centerY) * 100) / 100}%) scale(${z.scale})`,
  };
}

export function proofZoomLabel(zoomed: boolean): string {
  return zoomed ? "Zoom out" : "Zoom in";
}

/** Screen-reader announcement after a toggle. */
export function proofZoomStatus(zoomed: boolean, z: ProofZoom, hasBox: boolean): string {
  if (!zoomed) return "Zoomed out. The whole photo is in view.";
  const times = Number.isInteger(z.scale) ? String(z.scale) : z.scale.toFixed(1);
  return hasBox ? `Zoomed in ${times} times on the outline.` : `Zoomed in ${times} times on the middle of the photo.`;
}
