/**
 * Tester code for real runs. Real runs spend model credits, so /api/** only answers requests that carry
 * the code (checked in src/proxy.ts against SIGHTWORK_TEST_CODE). The tester types it once on
 * /start?runner=api; it stays in this browser's localStorage and is sent as a header on each run.
 */
export const TEST_CODE_HEADER = "x-sightwork-test-code";
const KEY = "sightwork:test-code";

export function loadTestCode(): string {
  try {
    return typeof window === "undefined" ? "" : (window.localStorage.getItem(KEY) ?? "");
  } catch {
    return "";
  }
}

export function saveTestCode(code: string): void {
  try {
    const v = code.trim();
    if (v) window.localStorage.setItem(KEY, v);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage off: the code just isn't remembered */
  }
}
