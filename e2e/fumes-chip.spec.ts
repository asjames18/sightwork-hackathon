import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example plan needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("a paint step says to ventilate, and a valve step does not", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example");
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const ceiling = steps.locator(":scope > li", { hasText: "Prime, paint and trim" });
    await expect(ceiling.getByTestId("step-fumes")).toContainText("Ventilate while working");
    const valve = steps.locator(":scope > li", { hasText: "Replace the leaking valve" });
    await expect(valve.getByTestId("step-fumes")).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `fumes chip ${width}`);
  }
});
