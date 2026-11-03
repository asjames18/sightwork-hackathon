import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example plan needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("a ceiling step says it is work up high, and a valve step does not", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example");
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const ceiling = steps.locator(":scope > li", { hasText: "Hang the new ceiling" });
    await expect(ceiling.getByTestId("step-height")).toContainText("Working up high");
    const valve = steps.locator(":scope > li", { hasText: "Replace the leaking valve" });
    await expect(valve.getByTestId("step-height")).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `height chip ${width}`);
  }
});
