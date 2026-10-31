import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("Start here names the steps that fix the Fix now problems and links to them", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const card = page.getByTestId("fix-first");
  await expect(card.getByRole("heading", { name: "Start here" })).toBeVisible();
  await expect(card.getByTestId("fix-first-lead")).toHaveText(/3 problems are Fix now\.\s*These 2 steps take care of them:/);
  await expect(card.getByRole("listitem")).toHaveCount(2);
  await expect(card.getByTestId("fix-first-facts")).toContainText("About 6–9 h of work");
  await expect(card).toContainText("The other 2 steps can follow");
  await card.getByRole("link", { name: /Step 2:/ }).click();
  await expect(page).toHaveURL(/#step-2$/);
  await expect(page.locator("#step-2")).toBeInViewport();
});

test("Start here fits and passes axe at 375, 768 and 1280", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    await page.getByTestId("fix-first").scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `start here ${width}`);
  }
});
