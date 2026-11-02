/**
 * The note the processing screen shows when the device goes offline during a real run. A real run is
 * one long streamed request, so a dropped connection usually ends it; an example run needs no network,
 * so it gets no note. Returns null when there is nothing to say.
 */
export function offlineNote(online: boolean, opts: { real: boolean; failed: boolean }): string | null {
  if (online || !opts.real) return null;
  return opts.failed
    ? "You're offline. Reconnect to Wi-Fi or mobile data, then tap Try again."
    : "You're offline. The plan needs a connection to finish, so stay on this screen; if the run stops, reconnect and tap Try again.";
}

/** navigator.onLine, read safely: treat an unknown state (no navigator, or not a boolean) as online. */
export function readOnline(nav: { onLine?: unknown } | undefined): boolean {
  return nav?.onLine !== false;
}
