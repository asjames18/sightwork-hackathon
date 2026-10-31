import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * While the browser sends the narration to /api/transcribe, the processing screen is on "Listening",
 * not still on "Uploading". /api stays blocked (helpers.ts) except the held stub below; nothing reaches a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const width of [375, 768, 1280]) {
  test(`narration being read shows on the Listening row (${width} px)`, async ({ page }) => {
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
    await expect(page.getByText("Sending your video. Bigger files take a little longer.")).toHaveCount(0);
    // One piece of narration: no "part N of M" line.
    await expect(page.getByText(/Reading part \d+ of \d+/)).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `processing while narration is read (${width} px)`);
    // Left held: the page closes with the narration still being read, so no plan request is made.
    void release;
  });
}
