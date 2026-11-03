import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored runs need no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("sanctuary counts say on each tile how they were made, since the methods differ", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const counts = page.locator("#counts");
  await expect(counts.getByTestId("counts-footnote")).toHaveText("Counted from the video, from what the camera saw.");
  await expect(counts.getByTestId("count-method").filter({ hasText: "Counted from SAM 3.1 outlines" })).toHaveCount(6);
  await expect(counts.getByTestId("count-method").filter({ hasText: "SAM 3.1 outlines and the model differ, so a range" })).toHaveCount(1);
  await expect(counts.getByTestId("count-method").filter({ hasText: "Estimated by the model from the frames" })).toHaveCount(1);
});

test("kitchen counts read once as model estimates", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  await expect(page.locator("#counts").getByTestId("counts-footnote")).toContainText("Estimated by the model from the frames, for every count here.");
  await expect(page.locator("#counts").getByTestId("count-method")).toHaveCount(0);
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
