/**
 * When the "Back to top" button shows on a plan. It appears once the reader is about a screen and a half
 * down, so a short plan or the first screen never gets it, and it hides again near the top.
 */
export const BACK_TO_TOP_SCREENS = 1.5;

export function showBackToTop(scrollY: number, viewportHeight: number): boolean {
  if (!Number.isFinite(scrollY) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return false;
  return scrollY > viewportHeight * BACK_TO_TOP_SCREENS;
}
