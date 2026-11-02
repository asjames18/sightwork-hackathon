import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * A saved take on the start screen can be watched back inline before it's used: Watch opens a player
 * under the row, Close (or Remove) shuts it, and it is hidden in print. The fake camera records a
 * short take; no request ever reaches /api.
 */
test.beforeEach(async ({ apiCalls, pageErrors, context }) => {
  void apiCalls;
  void pageErrors;
  await context.grantPermissions(["camera", "microphone"]);
});

for (const width of [375, 768, 1280]) {
  test(`saved takes: Watch plays a take back inline (${width} px)`, async ({ page }) => {
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
    await expect(list.getByTestId("take-preview")).toHaveCount(0);

    const watch = list.getByRole("button", { name: /^Watch .+ on this device$/ });
    await expect(watch).toHaveAttribute("aria-expanded", "false");
    await watch.click();
    const preview = list.getByTestId("take-preview");
    await expect(preview).toBeVisible();
    const video = preview.locator("video");
    await expect(video).toHaveAttribute("src", /^blob:/);
    await expect(video).toHaveAttribute("controls", "");
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
    const close = list.getByRole("button", { name: /^Close the playback of / });
    await expect(close).toHaveAttribute("aria-expanded", "true");
    await expect(close).toHaveText("Close");
    const box = await preview.boundingBox();
    expect(box && box.width > 200).toBeTruthy();
    if (process.env.E2E_SHOTS) await list.screenshot({ path: `e2e/.results/take-preview-${width}.png` });
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `saved take playback (${width} px)`);

    await page.emulateMedia({ media: "print" });
    await expect(preview).toBeHidden();
    await page.emulateMedia({ media: "screen" });

    await close.click();
    await expect(list.getByTestId("take-preview")).toHaveCount(0);
    await expect(watch).toHaveAttribute("aria-expanded", "false");

    // Removing the open take closes its player too.
    await watch.click();
    await expect(list.getByTestId("take-preview")).toBeVisible();
    await list.getByRole("button", { name: /^Remove / }).click();
    await expect(page.getByTestId("take-preview")).toHaveCount(0);
  });
}
