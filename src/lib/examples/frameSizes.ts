import type { WorkPlan } from "../types";

/**
 * Pixel sizes of the bundled example images (public/examples/**), so proof frames can reserve their space
 * before the image loads (no layout shift). Regenerate if an image there is replaced.
 */
export const FRAME_SIZES: Record<string, [number, number]> = {
  "/examples/kitchen/f0.webp": [648, 486],
  "/examples/kitchen/f1.webp": [648, 486],
  "/examples/kitchen/f2.webp": [931, 678],
  "/examples/kitchen/f3.webp": [697, 611],
  "/examples/kitchen/f4.webp": [648, 486],
  "/examples/kitchen/f5.webp": [696, 606],
  "/examples/kitchen/f6.webp": [709, 608],
  "/examples/samples/classroom.webp": [874, 768],
  "/examples/samples/office.webp": [1024, 682],
  "/examples/samples/warehouse.webp": [1024, 682],
  "/examples/sanctuary/after.webp": [1280, 853],
  "/examples/sanctuary/f0.webp": [1024, 576],
  "/examples/sanctuary/f1.webp": [1024, 576],
  "/examples/sanctuary/f2.webp": [1024, 576],
  "/examples/sanctuary/f3.webp": [1024, 576],
  "/examples/sanctuary/f4.webp": [1024, 576],
  "/examples/sanctuary/f5.webp": [1024, 576],
  "/examples/sanctuary/f6.webp": [1024, 576],
  "/examples/sanctuary/f7.webp": [1024, 576],
};

/** Copies a plan with width/height filled in on frames whose image size is known. */
export function withFrameSizes(plan: WorkPlan): WorkPlan {
  if (!plan.frames) return plan;
  return {
    ...plan,
    frames: plan.frames.map((f) => {
      const size = FRAME_SIZES[f.url];
      return size && !f.width ? { ...f, width: size[0], height: size[1] } : f;
    }),
  };
}
