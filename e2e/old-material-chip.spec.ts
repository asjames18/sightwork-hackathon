import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example plan needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("a step that pulls down old plaster says to check for lead or asbestos, and a new-ceiling step does not", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example");
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const plaster = steps.locator(":scope > li", { hasText: "Make the ceiling safe" });
    await expect(plaster.getByTestId("step-old-material")).toContainText("Check for lead or asbestos");
    const newCeiling = steps.locator(":scope > li", { hasText: "Hang the new ceiling" });
    await expect(newCeiling.getByTestId("step-old-material")).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `old material chip ${width}`);
  }
});
