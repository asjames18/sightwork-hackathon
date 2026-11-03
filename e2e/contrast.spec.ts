import { test, expect, expectNoAxeViolations, expectNoSideScroll, openDisplaySettings } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("contrast button turns small gray text solid and is kept on this device", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    await openDisplaySettings(page);
    const button = page.getByTestId("contrast");
    await expect(button).toHaveText("Contrast: Normal");
    await expect(button).toHaveAttribute("aria-pressed", "false");
    const soft = page.locator('[class*="text-ink/70"]').first();
    const before = await soft.evaluate((el) => getComputedStyle(el).color);
    await button.click();
    await expect(button).toHaveText("Contrast: High");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    const after = await soft.evaluate((el) => getComputedStyle(el).color);
    expect(after).not.toBe(before);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `high contrast ${width}`);
    await page.reload();
    await openDisplaySettings(page);
    await expect(page.getByTestId("contrast")).toHaveText("Contrast: High");
    await page.getByTestId("contrast").click();
    await expect(page.locator("html")).not.toHaveAttribute("data-contrast", /.+/);
  }
});

test("contrast button is not printed", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await openDisplaySettings(page);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("contrast")).toBeHidden();
});
