/**
 * Asks "Leave this page?" if the page is closed, reloaded or left while a real run is in progress, so a
 * stray pull-to-refresh or a swipe back on a phone can't throw away a plan that is still being made.
 * Browsers show their own wording and only ask once the person has tapped something on the page.
 */

type Target = {
  addEventListener(type: "beforeunload", fn: (e: BeforeUnloadEvent) => void): void;
  removeEventListener(type: "beforeunload", fn: (e: BeforeUnloadEvent) => void): void;
};

/** Whether leaving should be questioned: only a real run that is still going. */
export function shouldGuardLeave(state: { realRun: boolean; failed: boolean }): boolean {
  return state.realRun === true && state.failed !== true;
}

/** Turns the leave question on until the returned function is called. Never throws. */
export function guardLeave(target: Target | undefined = typeof window !== "undefined" ? window : undefined): () => void {
  if (!target) return () => {};
  const onLeave = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    // Older browsers read this value; the text itself is never shown.
    e.returnValue = "";
  };
  target.addEventListener("beforeunload", onLeave);
  return () => target.removeEventListener("beforeunload", onLeave);
}
