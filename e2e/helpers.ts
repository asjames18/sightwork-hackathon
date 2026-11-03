import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import path from "node:path";

export const FIXTURES = path.join(__dirname, "fixtures");
/** 6 s synthetic test pattern with a tone (VP8/Vorbis, plays in Playwright's Chromium). */
export const WALKTHROUGH = path.join(FIXTURES, "walkthrough-6s.webm");
/** 3 s clip, under the 5 s minimum. */
export const SHORT_CLIP = path.join(FIXTURES, "clip-3s.webm");
/** 6 s of plain black: a take with nothing to see (lens covered). */
export const BLANK_CLIP = path.join(FIXTURES, "blank-6s.webm");
/** 6 s upright (360 x 640) clip, like a phone held up and down. */
export const PORTRAIT_CLIP = path.join(FIXTURES, "portrait-6s.webm");
/** 6 s test picture with a quiet 220 Hz tone (about -26 dBFS), standing in for narration from arm's length. */
export const QUIET_NARRATION_CLIP = path.join(FIXTURES, "quiet-narration-6s.webm");
export const PHONE_MOV_SPATIAL_FIRST = path.join(FIXTURES, "speech-6s-apac-first.mov");

/**
 * `page` with /api/** aborted in the browser and every attempt recorded, plus console errors and
 * uncaught page errors collected. Each test fails afterwards if any of those happened.
 */
export const test = base.extend<{ apiCalls: string[]; pageErrors: string[]; expectedConsoleErrors: RegExp[] }>({
  /** Console errors a test expects (e.g. the browser's own "404" line on the not-found page). Default none. */
  expectedConsoleErrors: [[], { option: true }],
  apiCalls: async ({ page }, use) => {
    const calls: string[] = [];
    await page.route("**/api/**", (route) => {
      calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.abort();
    });
    await use(calls);
    expect(calls, "the browser must never call /api in these checks").toEqual([]);
  },
  pageErrors: async ({ page, expectedConsoleErrors }, use) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !expectedConsoleErrors.some((re) => re.test(m.text()))) errors.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await use(errors);
    expect(errors, "no console errors or uncaught exceptions").toEqual([]);
  },
});

export { expect };

/** axe at WCAG 2.2 AA plus best practices; any violation fails the test. */
export async function expectNoAxeViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(violations.map((v) => `${v.id} (${v.nodes.length})`), `axe on ${label}`).toEqual([]);
}

/** The page never scrolls sideways. */
export async function expectNoSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

/** Opens the plan header's "Display and voice" box (pace, text size and contrast buttons) if it is closed. */
export async function openDisplaySettings(page: Page) {
  const box = page.getByTestId("display-settings");
  await expect(box).toBeVisible();
  if (!(await box.evaluate((el) => (el as HTMLDetailsElement).open))) await box.locator("summary").click();
  await expect(box.locator("summary ~ div")).toBeVisible();
}
