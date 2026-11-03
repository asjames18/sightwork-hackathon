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
  "/examples/sanctuary-walk/after.webp": [1280, 853],
  "/examples/sanctuary-walk/f0.webp": [576, 1024],
  "/examples/sanctuary-walk/f1.webp": [576, 1024],
  "/examples/sanctuary-walk/f2.webp": [576, 1024],
  "/examples/sanctuary-walk/f3.webp": [576, 1024],
  "/examples/sanctuary-walk/f4.webp": [576, 1024],
  "/examples/sanctuary-walk/f5.webp": [576, 1024],
  "/examples/sanctuary-walk/f6.webp": [576, 1024],
  "/examples/sanctuary-walk/f7.webp": [576, 1024],
  "/examples/sanctuary-walk/f8.webp": [576, 1024],
  "/examples/sanctuary-walk/f9.webp": [576, 1024],
  "/examples/sanctuary-walk/f10.webp": [576, 1024],
  "/examples/sanctuary-walk/f11.webp": [576, 1024],
  "/examples/sanctuary-walk/f12.webp": [576, 1024],
  "/examples/sanctuary-walk/f13.webp": [576, 1024],
  "/examples/sanctuary-walk/f14.webp": [576, 1024],
  "/examples/sanctuary-walk/f15.webp": [576, 1024],
  "/examples/sanctuary-walk/f16.webp": [576, 1024],
  "/examples/sanctuary-walk/f17.webp": [576, 1024],
  "/examples/sanctuary-walk/f18.webp": [576, 1024],
  "/examples/sanctuary-walk/f19.webp": [576, 1024],
  "/examples/sanctuary-walk/f20.webp": [576, 1024],
  "/examples/sanctuary-walk/f21.webp": [576, 1024],
  "/examples/sanctuary-walk/f22.webp": [576, 1024],
  "/examples/sanctuary-walk/f23.webp": [576, 1024],
  "/examples/sanctuary-walk/f24.webp": [576, 1024],
  "/examples/sanctuary-walk/f25.webp": [576, 1024],
  "/examples/sanctuary-walk/f26.webp": [576, 1024],
  "/examples/sanctuary-walk/f27.webp": [576, 1024],
  "/examples/sanctuary-walk/f28.webp": [576, 1024],
  "/examples/sanctuary-walk/f29.webp": [576, 1024],
  "/examples/sanctuary-walk/f30.webp": [576, 1024],
  "/examples/sanctuary-walk/f31.webp": [576, 1024],
  "/examples/sanctuary-walk/f32.webp": [576, 1024],
  "/examples/sanctuary-walk/f33.webp": [576, 1024],
  "/examples/sanctuary-walk/f34.webp": [576, 1024],
  "/examples/sanctuary-walk/f35.webp": [576, 1024],
  "/examples/sanctuary-walk/f36.webp": [576, 1024],
  "/examples/sanctuary-walk/f37.webp": [576, 1024],
  "/examples/sanctuary-walk/f38.webp": [576, 1024],
  "/examples/sanctuary-walk/f39.webp": [576, 1024],
  "/examples/sanctuary-walk/f40.webp": [576, 1024],
  "/examples/sanctuary-walk/f41.webp": [576, 1024],
  "/examples/sanctuary-walk/f42.webp": [576, 1024],
  "/examples/sanctuary-walk/f43.webp": [576, 1024],
  "/examples/sanctuary-walk/f44.webp": [576, 1024],
  "/examples/sanctuary-walk/f45.webp": [576, 1024],
  "/examples/sanctuary-walk/f46.webp": [576, 1024],
  "/examples/sanctuary-walk/f47.webp": [576, 1024],
  "/examples/thumbs/sanctuary-walk.webp": [720, 405],
  "/examples/thumbs/classroom.webp": [720, 633],
  "/examples/thumbs/office.webp": [720, 480],
  "/examples/thumbs/sanctuary.webp": [720, 405],
  "/examples/thumbs/warehouse.webp": [720, 480],
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
