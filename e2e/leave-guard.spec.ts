import { test, expect, WALKTHROUGH } from "./helpers";

/**
 * While a real run is going the page asks before it is reloaded or closed; a preview run does not, and
 * the question goes away once the run is stopped. /api stays blocked (helpers.ts) except the held
 * transcribe stub; nothing reaches a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const asksBeforeLeaving = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });

test("a real run asks before leaving, and stops asking once it is stopped", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/transcribe", async (r) => {
    await held;
    await r.fulfill({ json: { transcript: "", transcriptTurns: [] } }).catch(() => {});
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("sightwork:test-code", "stub-code");
    window.localStorage.setItem("sightwork:location", JSON.stringify({ city: "Sebring", state: "FL" }));
  });
  await page.goto("/start?runner=api");
  expect(await asksBeforeLeaving(page)).toBe(false);
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("group", { name: "Your walkthrough" }).getByRole("button", { name: "Make my work plan" }).click();
  await expect(page.getByText("Turning what you said into a list of requests.")).toBeVisible({ timeout: 30_000 });
  expect(await asksBeforeLeaving(page)).toBe(true);

  await page.getByRole("button", { name: "Stop this run" }).click();
  await page.getByRole("button", { name: "Stop run" }).click();
  await expect(page.getByTestId("stopped-run-note")).toBeVisible();
  expect(await asksBeforeLeaving(page)).toBe(false);
  release();
});

test("a preview run never asks before leaving", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toBeVisible();
  expect(await asksBeforeLeaving(page)).toBe(false);
});
