import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * With two or more saved takes, the one whose length fits the room size best is marked "Best pick", and
 * the label follows the room size picker. The fake camera records two short takes; no request ever
 * reaches /api.
 */
test.beforeEach(async ({ apiCalls, pageErrors, context }) => {
  void apiCalls;
  void pageErrors;
  await context.grantPermissions(["camera", "microphone"]);
});

async function recordTake(page: import("@playwright/test").Page, ms: number) {
  await page.goto("/start");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const cam = page.getByRole("group", { name: "Camera" });
  await expect(cam).toHaveAttribute("data-phase", "ready");
  await cam.getByRole("button", { name: "Start recording" }).click();
  await expect(cam).toHaveAttribute("data-phase", "recording");
  await page.waitForTimeout(ms);
  await cam.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByRole("group", { name: "Your walkthrough" })).toBeVisible();
}

for (const width of [375, 768, 1280]) {
  test(`saved takes: best pick marks one take and follows the room size (${width} px)`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    // Both takes are short for Medium, so the longer one (recorded first, listed second) is the pick.
    await recordTake(page, 9500);
    await recordTake(page, 6500);

    await page.goto("/start");
    const list = page.getByTestId("saved-takes");
    const rows = list.getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(list.getByTestId("take-best")).toHaveCount(1);
    const best = rows.nth(1).getByTestId("take-best");
    await expect(best).toContainText("Best pick for Medium");
    await expect(best.locator(".sr-only")).toContainText("medium space");

    await page.locator('label[data-size="small"]').first().click();
    await expect(best).toContainText("Best pick for Small");

    if (process.env.E2E_SHOTS) await list.screenshot({ path: `e2e/.results/take-best-${width}.png` });
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `saved takes best pick (${width} px)`);

    await page.emulateMedia({ media: "print" });
    await expect(best).toBeHidden();
  });
}

test("saved takes: a single take gets no best pick", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await recordTake(page, 6500);
  await page.goto("/start");
  await expect(page.getByTestId("saved-takes").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByTestId("take-best")).toHaveCount(0);
});
