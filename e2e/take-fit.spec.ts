import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Each saved take on the start screen says how its length fits the room size picked there, and the
 * line follows the picker. The fake camera records a short take; no request ever reaches /api.
 */
test.beforeEach(async ({ apiCalls, pageErrors, context }) => {
  void apiCalls;
  void pageErrors;
  await context.grantPermissions(["camera", "microphone"]);
});

for (const width of [375, 768, 1280]) {
  test(`saved takes: length fit follows the room size (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start");
    await page.getByRole("button", { name: "Record a walkthrough" }).click();
    const cam = page.getByRole("group", { name: "Camera" });
    await expect(cam).toHaveAttribute("data-phase", "ready");
    await cam.getByRole("button", { name: "Start recording" }).click();
    await expect(cam).toHaveAttribute("data-phase", "recording");
    await page.waitForTimeout(6500);
    await cam.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("group", { name: "Your walkthrough" })).toBeVisible();

    await page.goto("/start");
    const list = page.getByTestId("saved-takes");
    await expect(list.getByRole("listitem")).toHaveCount(1);
    const fit = list.getByTestId("take-fit");
    await expect(fit).toHaveAttribute("data-tone", "short");
    await expect(fit).toContainText("Short for Medium (aim 60–90 s)");
    await expect(fit.locator(".sr-only")).toContainText("medium space");

    await page.locator('label[data-size="small"]').first().click();
    await expect(fit).toContainText("Short for Small (aim 30–60 s)");
    await page.locator('label[data-size="xl"]').first().click();
    await expect(fit).toContainText("Short for Extra large (aim 3–5 min)");

    if (process.env.E2E_SHOTS) await list.screenshot({ path: `e2e/.results/take-fit-${width}.png` });
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `saved take length fit (${width} px)`);

    await page.emulateMedia({ media: "print" });
    await expect(fit).toBeHidden();
  });
}
