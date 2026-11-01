import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * "Stop this run" on the processing screen: a preview run stops on the first tap; a real run asks first
 * (Keep going / Stop run). Both go back to the upload screen with the same video kept and a short note.
 * /api stays blocked (helpers.ts) except the held transcribe stub; nothing reaches a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const width of [375, 768, 1280]) {
  test(`preview run: Stop this run goes back to the same video (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start");
    await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
    await page.getByRole("button", { name: "Make my work plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toBeVisible();
    const stop = page.getByRole("button", { name: "Stop this run" });
    await expect(stop).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `processing with stop (${width} px)`);
    await stop.click();
    const card = page.getByRole("group", { name: "Your walkthrough" });
    await expect(card).toContainText("walkthrough-6s.webm");
    await expect(page.getByTestId("stopped-run-note")).toHaveText(
      "Run stopped. walkthrough-6s.webm is still here, so you can change the details and start again.",
    );
    await expect(page.getByRole("button", { name: "Make my work plan" })).toBeEnabled();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `upload after stop (${width} px)`);
    // The stopped preview never finishes into a plan.
    await page.waitForTimeout(1500);
    await expect(page.getByRole("heading", { name: "Problems, worst first" })).toHaveCount(0);
  });
}

test("real run: asks first, Keep going stays, Stop run goes back with the video", async ({ page }) => {
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
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("group", { name: "Your walkthrough" }).getByRole("button", { name: "Make my work plan" }).click();
  await expect(page.getByText("Turning what you said into a list of requests.")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Stop this run" }).click();
  const confirm = page.getByTestId("stop-run-confirm");
  await expect(confirm).toContainText("may still finish, but nothing after it runs");
  await expect(page.getByRole("button", { name: "Keep going" })).toBeFocused();
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "stop confirm (390 px)");
  await page.getByRole("button", { name: "Keep going" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Stop this run" })).toBeFocused();
  await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toBeVisible();

  await page.getByRole("button", { name: "Stop this run" }).click();
  await page.getByRole("button", { name: "Stop run" }).click();
  await expect(page.getByTestId("stopped-run-note")).toContainText("walkthrough-6s.webm is still here");
  await expect(page.getByRole("group", { name: "Your walkthrough" }).getByRole("button", { name: "Make my work plan" })).toBeEnabled();
  // Stopped before the plan request: the held narration is released into an aborted page state.
  release();
  await page.waitForTimeout(500);
  await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toHaveCount(0);
});
