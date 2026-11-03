import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Landing "What you get": six cards (the last one is the work-day tools), so the grid is even at
 * two and three columns. /api stays blocked (helpers.ts); nothing here reaches a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const width of [375, 768, 1280]) {
  test(`What you get lists six cards, with the work-day card last (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const section = page.locator("section[aria-labelledby='get-heading']");
    await expect(section.getByRole("heading", { level: 2, name: "What you get" })).toBeVisible();
    const cards = section.locator("ul > li");
    await expect(cards).toHaveCount(6);
    const last = cards.nth(5);
    await last.scrollIntoViewIfNeeded();
    await expect(last.getByRole("heading", { level: 3, name: "Ready for work day." })).toBeVisible();
    await expect(last).toContainText("Tick steps off");
    const box = await last.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `landing what you get (${width} px)`);
  });
}
