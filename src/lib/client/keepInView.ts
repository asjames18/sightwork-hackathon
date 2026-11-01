/**
 * How far to scroll so a control stays readable after the content around it changes size.
 * `top` and `bottom` are the control's viewport box, `line` is the bottom of the sticky header and chips,
 * `viewport` is the window height and `gap` is the breathing room kept under the line.
 * Returns 0 when the control already sits fully between the line and the bottom of the window.
 */
export function keepInViewDelta(box: { top: number; bottom: number }, line: number, viewport: number, gap = 8): number {
  const want = line + gap;
  if (box.top < want) return Math.round(box.top - want);
  if (box.bottom > viewport) {
    // Bring it up just far enough to show it whole, but never past the line.
    const up = box.bottom - viewport + gap;
    return Math.round(Math.min(up, box.top - want));
  }
  return 0;
}

/** Bottom edge of whatever is pinned at the top of the page (header, then the plan's section chips). */
export function stickyLine(doc: Document = document): number {
  let line = 0;
  for (const el of doc.querySelectorAll<HTMLElement>("body > header, [data-testid='section-nav']")) {
    const pos = getComputedStyle(el).position;
    if (pos !== "sticky" && pos !== "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.top <= 1 + line && r.bottom > line) line = r.bottom;
  }
  return line;
}
