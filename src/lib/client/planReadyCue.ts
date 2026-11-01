/**
 * Plan-ready cue for the browser tab. A real run takes a minute or more, so people switch apps or tabs
 * while it works. When the plan opens while the tab is in the background, the tab title says the plan is
 * ready (and how many problems it found) until the tab is shown again, then the normal title comes back.
 */

type CueDocument = Pick<Document, "hidden" | "title" | "addEventListener" | "removeEventListener">;

/** Tab title while a finished plan waits in a background tab. */
export function planReadyTitle(problemCount: number | null | undefined): string {
  const n = typeof problemCount === "number" && Number.isFinite(problemCount) ? Math.max(0, Math.floor(problemCount)) : null;
  if (n === null) return "Plan ready · SightWork";
  return `Plan ready: ${n} ${n === 1 ? "problem" : "problems"} · SightWork`;
}

/**
 * Shows the plan-ready title when the tab is hidden and puts the earlier title back once the tab is visible.
 * Does nothing when the tab is already on screen. Returns a cleanup that removes the listener and restores
 * the title if the cue is still showing (for leaving the plan before coming back to the tab).
 */
export function cuePlanReady(problemCount: number | null | undefined, doc: CueDocument | undefined = typeof document === "undefined" ? undefined : document): () => void {
  if (!doc || !doc.hidden) return () => {};
  const before = doc.title;
  const cue = planReadyTitle(problemCount);
  doc.title = cue;
  let active = true;
  const stop = () => {
    if (!active) return;
    active = false;
    doc.removeEventListener("visibilitychange", onVisible);
    // Only put the old title back if nothing else changed it meanwhile.
    if (doc.title === cue) doc.title = before;
  };
  const onVisible = () => {
    if (!doc.hidden) stop();
  };
  doc.addEventListener("visibilitychange", onVisible);
  return stop;
}
