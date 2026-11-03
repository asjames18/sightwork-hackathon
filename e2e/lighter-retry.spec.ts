import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * A real run cut at the host's time limit offers "Try again, lighter" (fewer, smaller frames) and says why; a run
 * lost to a dropped connection keeps the plain "Try again". /api stays blocked (helpers.ts) except the stubbed routes.
 */
async function startRun(page: import("@playwright/test").Page, skewMs: number) {
  await page.addInitScript(() => {
    const real = Date.now.bind(Date);
    (window as unknown as { __skew: number }).__skew = 0;
    Date.now = () => real() + (window as unknown as { __skew: number }).__skew;
  });
  await page.route("**/api/transcribe", (r) => r.fulfill({ json: { transcript: "", transcriptTurns: [] } }));
  await page.route("**/api/plan", async (r) => {
    await page.evaluate((n) => ((window as unknown as { __skew: number }).__skew = n), skewMs);
    await r.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ state: "running", step: "comparing" }) + "\n" });
  });
  await page.addInitScript(() => window.localStorage.setItem("sightwork:test-code", "stub-code"));
  await page.addInitScript(() => window.localStorage.setItem("sightwork:location", JSON.stringify({ city: "Atlanta", state: "GA" })));
  await page.goto("/start?runner=api");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
}

test("a run cut at the time limit offers a lighter try", async ({ page }) => {
  await startRun(page, 300_000);
  await expect(page.getByRole("alert").filter({ hasText: "hit the 5-minute limit" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Try again, lighter" })).toBeVisible();
  const note = page.getByTestId("lighter-retry-note");
  await expect(note).toContainText("fewer, smaller pictures");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(note).toBeVisible();
    await expectNoSideScroll(page);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(page, "time-limit stop with a lighter try");
});

test("a dropped connection keeps the plain Try again", async ({ page }) => {
  await startRun(page, 0);
  await expect(page.getByRole("alert").filter({ hasText: "The connection dropped before the plan finished." })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page.getByTestId("lighter-retry-note")).toHaveCount(0);
});
