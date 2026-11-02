import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("Back to top shows on a long plan, returns to the title and moves focus there", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("back-to-top")).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const button = page.getByRole("button", { name: "Back to top" });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box && box.height >= 44).toBe(true);
    expect(box && box.x + box.width <= width).toBe(true);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `back to top ${width}`);

    await button.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
    await expect(page.locator("#plan-top")).toBeFocused();
    await expect(page.getByTestId("back-to-top")).toHaveCount(0);
  }
});
