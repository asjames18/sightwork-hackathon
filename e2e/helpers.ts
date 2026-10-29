import { test as base, expect } from "@playwright/test";
import path from "node:path";

export const FIXTURES = path.join(__dirname, "fixtures");
/** 6 s synthetic test pattern with a tone (VP8/Vorbis, plays in Playwright's Chromium). */
export const WALKTHROUGH = path.join(FIXTURES, "walkthrough-6s.webm");
/** 3 s clip, under the 5 s minimum. */
export const SHORT_CLIP = path.join(FIXTURES, "clip-3s.webm");

/**
 * `page` with /api/** aborted in the browser and every attempt recorded, plus console errors and
 * uncaught page errors collected. Each test fails afterwards if any of those happened.
 */
export const test = base.extend<{ apiCalls: string[]; pageErrors: string[] }>({
  apiCalls: async ({ page }, use) => {
    const calls: string[] = [];
    await page.route("**/api/**", (route) => {
      calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.abort();
    });
    await use(calls);
    expect(calls, "the browser must never call /api in these checks").toEqual([]);
  },
  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await use(errors);
    expect(errors, "no console errors or uncaught exceptions").toEqual([]);
  },
});

export { expect };
