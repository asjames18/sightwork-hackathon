/**
 * Watching a saved take back on the start screen before using it. One take plays at a time, so the
 * list stays short on a phone; tapping Watch on the open take closes it again.
 */

/** Which take is open after a tap on Watch: the tapped one, or none when it was already open. */
export function nextOpenTake(current: string | null, tapped: string): string | null {
  if (typeof tapped !== "string" || !tapped) return current;
  return current === tapped ? null : tapped;
}

/** The open take, or null once it has left the list (removed, or pushed off by a newer take). */
export function keepOpenTake(current: string | null, ids: readonly string[]): string | null {
  return current && ids.includes(current) ? current : null;
}

/** Button text and the screen reader label for a take's Watch button. */
export function takeWatchLabels(open: boolean, name: string): { text: string; aria: string } {
  return open
    ? { text: "Close", aria: `Close the playback of ${name}` }
    : { text: "Watch", aria: `Watch ${name} on this device` };
}
