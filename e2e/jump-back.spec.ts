import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("after a step's Fixes link, Back to step N returns to the step and the link", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    await expect(page.getByTestId("jump-back")).toHaveCount(0);
    const step1 = page.locator("#step-1");
    await step1.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const startY = await page.evaluate(() => window.scrollY);
    const link = step1.getByRole("link", { name: "Go to problem 2" });
    await link.click();
    await expect(page).toHaveURL(/#problem-2$/);

    const back = page.getByRole("button", { name: "Back to step 1" });
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
    expect(box && box.height >= 44).toBe(true);
    expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `jump back ${width}`);

    await back.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(startY + 5);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(startY - 5);
    await expect(link).toBeFocused();
    await expect(page.getByTestId("jump-back")).toHaveCount(0);
  }
});

test("a problem's Fixed in step link offers Back to problem, and scrolling back by hand hides it", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/start?view=example&ex=sanctuary");
  const card4 = page.locator("#problem-4");
  await card4.scrollIntoViewIfNeeded();
  const startY = await page.evaluate(() => window.scrollY);
  await card4.getByRole("link", { name: "step 4" }).click();
  await expect(page.getByRole("button", { name: "Back to problem #4" })).toBeVisible();
  await page.evaluate((y) => window.scrollTo(0, y), startY);
  await expect(page.getByTestId("jump-back")).toHaveCount(0);
});

test("the button is hidden in print", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await page.locator("#step-1").getByRole("link", { name: "Go to problem 2" }).click();
  await expect(page.getByTestId("jump-back")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("jump-back")).toBeHidden();
});
