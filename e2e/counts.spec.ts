import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored runs need no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("sanctuary count tiles say they came from SAM 3.1 outlines", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const notes = page.locator("#counts").getByTestId("count-method");
  await expect(notes.first()).toHaveText("Counted from SAM 3.1 outlines");
  expect(await notes.count()).toBeGreaterThan(0);
});

test("kitchen count tiles read as model estimates", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  await expect(page.locator("#counts").getByTestId("count-method").first()).toContainText("Estimated by the model from the frames");
});

test("count tiles fit and pass axe at 375, 768 and 1280", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    await page.locator("#counts").scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `counts ${width}`);
  }
});
