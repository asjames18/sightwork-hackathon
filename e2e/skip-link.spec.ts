import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Skip link: the first Tab stop on every page jumps past the header to the page itself, so keyboard
 * and screen reader users do not tab through the header buttons on every page. /api stays blocked
 * (helpers.ts); nothing here reaches a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const path of ["/", "/start", "/credits", "/status"]) {
  for (const width of [375, 768, 1280]) {
    test(`skip link is the first Tab stop and moves focus to the page on ${path} (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const link = page.getByTestId("skip-link");
      // Hidden until it has focus.
      await expect(link).toHaveCSS("position", "absolute");
      await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      await expect(link).toHaveText("Skip to main content");
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(24);
      await expectNoSideScroll(page);
      await expectNoAxeViolations(page, `skip link focused ${path} (${width} px)`);
      await page.keyboard.press("Enter");
      await expect(page.locator("#main-content")).toBeFocused();
      // The next Tab stop is inside the page, not back in the header.
      await page.keyboard.press("Tab");
      const insideHeader = await page.evaluate(() => Boolean(document.activeElement?.closest("header")));
      expect(insideHeader).toBe(false);
    });
  }
}

test("skip link appears once and the page has one main landmark", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByTestId("skip-link")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
});
