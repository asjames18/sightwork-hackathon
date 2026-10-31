import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("each problem says which step fixes it, and the link lands on that step", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const problems = page.locator("#problems");
  const card1 = problems.locator("#problem-1");
  await expect(card1.getByTestId("fixed-in")).toHaveText(/Fixed in step\s*1/);
  const card4 = problems.locator("#problem-4");
  await expect(card4.getByTestId("fixed-in")).toHaveText(/Fixed in steps\s*3\s*and\s*4/);

  await card4.getByRole("link", { name: "step 4" }).click();
  await expect(page).toHaveURL(/#step-4$/);
  await expect(page.locator("#step-4")).toBeInViewport();
});

test("each step's Fixes chip links back up to the problem cards", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const step1 = page.locator("#step-1");
  await expect(step1.getByTestId("step-fixes")).toHaveText("Fixes #1, #2");
  await step1.getByRole("link", { name: "Go to problem 2" }).click();
  await expect(page).toHaveURL(/#problem-2$/);
  await expect(page.locator("#problem-2")).toBeInViewport();
});

test("links fit and pass axe at 375, 768 and 1280", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    await page.locator("#problem-4").scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `problem cards ${width}`);
    await page.locator("#step-1").scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `work steps ${width}`);
    await page.screenshot({ path: `/workspace/sw/run1030/links-${width}.png`, fullPage: false });
  }
});
