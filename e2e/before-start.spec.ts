import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example plans need no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("the work steps start with one closed box that lists each heads-up and links to its steps", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    const box = page.getByTestId("before-start");
    await box.scrollIntoViewIfNeeded();
    await expect(box).toBeVisible();
    expect(await box.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await expect(page.getByTestId("before-start-count")).toContainText(/things? to plan for/);
    await box.locator("summary").click();
    const notes = box.getByTestId("before-start-note");
    expect(await notes.count()).toBeGreaterThan(0);
    // Every note links to steps that exist, and each of those steps carries a chip of its own.
    const links = box.locator("a[href^='#step-']");
    const n = await links.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const href = (await links.nth(i).getAttribute("href")) ?? "";
      await expect(page.locator(href)).toHaveCount(1);
    }
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `before start ${width}`);
  }
});

test("a link in the box lands on its step", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/start?view=example&ex=kitchen");
  const box = page.getByTestId("before-start");
  await box.scrollIntoViewIfNeeded();
  await box.locator("summary").click();
  const link = box.locator("a[href^='#step-']").first();
  const href = (await link.getAttribute("href")) ?? "";
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.locator(href)).toBeInViewport();
});
