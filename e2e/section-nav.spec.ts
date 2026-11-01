import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("the chip for the section on screen is marked and follows the scroll", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const nav = page.getByTestId("section-nav");
  await expect(nav.locator('[aria-current="location"]')).toHaveCount(0);

  await nav.getByRole("link", { name: "Steps" }).click();
  await expect(nav.locator('[aria-current="location"]')).toHaveText("Steps");

  await nav.getByRole("link", { name: "Problems" }).click();
  await expect(nav.locator('[aria-current="location"]')).toHaveText("Problems");

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(nav.locator('[aria-current="location"]')).toHaveCount(1);
  const last = await nav.locator("a").last().textContent();
  await expect(nav.locator('[aria-current="location"]')).toHaveText(last ?? "");
});

test("the marked chip stays inside the chip row and the page fits at 375, 768 and 1280", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    const nav = page.getByTestId("section-nav");
    await nav.getByRole("link", { name: "Materials" }).click();
    const current = nav.locator('[aria-current="location"]');
    await expect(current).toHaveText("Materials");
    await expect
      .poll(async () => {
        const [chip, row] = await Promise.all([current.boundingBox(), nav.locator("ul").boundingBox()]);
        return !!chip && !!row && chip.x >= row.x - 1 && chip.x + chip.width <= row.x + row.width + 1;
      })
      .toBe(true);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `section nav ${width}`);
  }
});
