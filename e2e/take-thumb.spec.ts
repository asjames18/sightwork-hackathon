import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Each saved take on the start screen leads with a small still from its own video, read from this
 * device, so takes filmed back to back are easy to tell apart. Decorative, hidden in print with the
 * list. The fake camera records a short take; no request ever reaches /api.
 */
test.beforeEach(async ({ apiCalls, pageErrors, context }) => {
  void apiCalls;
  void pageErrors;
  await context.grantPermissions(["camera", "microphone"]);
});

for (const width of [375, 768, 1280]) {
  test(`saved takes: each take shows a still from its own video (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start");
    await page.getByRole("button", { name: "Record a walkthrough" }).click();
    const cam = page.getByRole("group", { name: "Camera" });
    await expect(cam).toHaveAttribute("data-phase", "ready");
    await cam.getByRole("button", { name: "Start recording" }).click();
    await expect(cam).toHaveAttribute("data-phase", "recording");
    await page.waitForTimeout(2000);
    await cam.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("group", { name: "Your walkthrough" })).toBeVisible();

    await page.goto("/start");
    const list = page.getByTestId("saved-takes");
    await expect(list.getByRole("listitem")).toHaveCount(1);
    const thumb = list.getByTestId("take-thumb");
    await expect(thumb).toHaveCount(1);
    await expect(thumb).toHaveAttribute("aria-hidden", "true");
    const video = thumb.locator("video");
    await expect(video).toHaveAttribute("src", /^blob:.+#t=\d+(\.\d+)?$/);
    await expect(video).toHaveJSProperty("muted", true);
    await expect(thumb).toHaveAttribute("data-painted", "yes");
    const box = await thumb.boundingBox();
    expect(box && box.width > 40 && box.height > 30).toBeTruthy();
    // The thumb must not push the take's buttons off a narrow screen.
    await list.getByRole("listitem").scrollIntoViewIfNeeded();
    await expect(list.getByRole("button", { name: /^Remove / })).toBeInViewport();
    if (process.env.E2E_SHOTS) await list.screenshot({ path: `e2e/.results/take-thumb-${width}.png` });
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `saved takes with still (${width} px)`);

    await page.emulateMedia({ media: "print" });
    await expect(thumb).toBeHidden();
  });
}

test("saved takes: a take whose video is gone drops off instead of showing an empty still", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.addInitScript(() => {
    const entry = { id: "t-missing", name: "walkthrough-2026-11-02-1500.webm", type: "video/webm", size: 1234, savedAt: new Date().toISOString(), durationSec: 12 };
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("sightwork:savedTakes:v1", JSON.stringify([entry]));
      sessionStorage.setItem("seeded", "1");
    }
  });
  await page.goto("/start");
  await expect(page.getByTestId("take-thumb")).toHaveCount(0);
  await expectNoSideScroll(page);
});
