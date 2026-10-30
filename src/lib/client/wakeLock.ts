/**
 * Keeps the phone screen on while the camera is open, so auto-lock can't cut a walkthrough short.
 * Uses the Screen Wake Lock API where it exists and does nothing elsewhere. The browser drops the
 * lock when the tab is hidden, so it is asked for again when the page comes back.
 */

type Sentinel = { release(): Promise<void>; released?: boolean };
type WakeLockApi = { request(type: "screen"): Promise<Sentinel> };

export function canKeepScreenOn(nav: unknown = typeof navigator !== "undefined" ? navigator : undefined): boolean {
  const wl = (nav as { wakeLock?: WakeLockApi } | undefined)?.wakeLock;
  return !!wl && typeof wl.request === "function";
}

/** Holds the screen awake until the returned function is called. Never throws. */
export function keepScreenOn(): () => void {
  if (typeof document === "undefined" || !canKeepScreenOn()) return () => {};
  const api = (navigator as unknown as { wakeLock: WakeLockApi }).wakeLock;
  let sentinel: Sentinel | null = null;
  let done = false;
  const acquire = () => {
    if (done || document.visibilityState !== "visible") return;
    if (sentinel && !sentinel.released) return;
    api
      .request("screen")
      .then((s) => {
        if (done) s.release().catch(() => {});
        else sentinel = s;
      })
      .catch(() => {
        /* refused (battery saver, no user gesture yet): the take still works */
      });
  };
  acquire();
  document.addEventListener("visibilitychange", acquire);
  return () => {
    done = true;
    document.removeEventListener("visibilitychange", acquire);
    sentinel?.release().catch(() => {});
    sentinel = null;
  };
}
