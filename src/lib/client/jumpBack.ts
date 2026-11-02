/**
 * "Back to step N" after an in-plan jump. Tapping a cross-link on the plan (a step's "Fixes #2" chip, a problem's
 * "Fixed in step 3", the summary's problem links) jumps far down or up the page; on a phone that loses the reader's
 * place. These helpers decide which links count, what the return button says and when it goes away on its own.
 */

/** In-plan links that jump to a problem card or a work step. */
const JUMP_HREF = /^#(problem|step)-(\d+)$/;

export function isJumpHref(href: string | null | undefined): boolean {
  return typeof href === "string" && JUMP_HREF.test(href);
}

/** The anchored card the tapped link sits in, as the label on the return button. */
export function jumpBackLabel(originId: string | null | undefined): string {
  const m = typeof originId === "string" ? /^(problem|step)-(\d+)$/.exec(originId) : null;
  if (!m) return "Back to where you were";
  return m[1] === "step" ? `Back to step ${Number(m[2])}` : `Back to problem #${Number(m[2])}`;
}

/** How close (in screens) the reader must be to where they were for the button to count as no longer needed. */
export const JUMP_BACK_NEAR_SCREENS = 0.5;

/** True when the scroll position is within half a screen of where the jump started. */
export function nearOrigin(scrollY: number, originY: number, viewportHeight: number): boolean {
  if (![scrollY, originY, viewportHeight].every(Number.isFinite) || viewportHeight <= 0) return true;
  return Math.abs(scrollY - originY) < viewportHeight * JUMP_BACK_NEAR_SCREENS;
}

/**
 * Whether the button should still show. It waits until the jump has actually carried the reader away (a smooth
 * scroll starts at the origin), then hides once they scroll back near it by hand.
 */
export function jumpBackState(
  prev: { away: boolean },
  scrollY: number,
  originY: number,
  viewportHeight: number,
): { away: boolean; show: boolean } {
  const near = nearOrigin(scrollY, originY, viewportHeight);
  if (!prev.away) return { away: !near, show: true };
  return { away: true, show: !near };
}
