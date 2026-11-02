import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Offline note on the processing screen: a real run says so when the device drops its connection and
 * clears the note when it comes back; an example run, which needs no network, shows nothing.
 * /api stays blocked (helpers.ts) except the held transcribe stub; nothing reaches a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const width of [375, 768, 1280]) {
  test(`real run: offline note shows and clears (${width} px)`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
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
    await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
    await page.getByRole("group", { name: "Your walkthrough" }).getByRole("button", { name: "Make my work plan" }).click();
    await expect(page.getByText("Turning what you said into a list of requests.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("offline-note")).toHaveCount(0);

    await context.setOffline(true);
    const note = page.getByTestId("offline-note");
    await expect(note).toBeVisible();
    await expect(note).toContainText("You're offline.");
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `processing offline note (${width} px)`);

    await context.setOffline(false);
    await expect(page.getByTestId("offline-note")).toHaveCount(0);
    release();
  });
}

test("example run: no offline note", async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/start");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toBeVisible();
  await context.setOffline(true);
  await page.waitForTimeout(300);
  await expect(page.getByTestId("offline-note")).toHaveCount(0);
  await context.setOffline(false);
});
