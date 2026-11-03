import { test, expect, PORTRAIT_CLIP, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("an upright video gets a soft sideways tip that goes away for a small room", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("choose-video-input").setInputFiles(PORTRAIT_CLIP);
  const tip = page.getByTestId("orientation-tip");
  await expect(tip).toContainText("filmed upright");
  await expect(tip).toHaveAttribute("role", "status");
  const make = page.getByRole("button", { name: "Make my work plan" });
  await expect(make).toBeEnabled();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(tip).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `orientation tip ${width}`);
  }
  // Small rooms are fine upright: the card's own size picker hides the tip.
  await page.getByRole("group", { name: "Your walkthrough" }).getByTestId("room-size-picker").getByText("Small", { exact: true }).click();
  await expect(tip).toHaveCount(0);
  await expect(make).toBeEnabled();
});

test("a sideways video shows no orientation tip", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await expect(page.getByRole("button", { name: "Make my work plan" })).toBeEnabled();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("orientation-tip")).toHaveCount(0);
});
