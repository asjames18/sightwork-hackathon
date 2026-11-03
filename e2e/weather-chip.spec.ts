import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example plans need no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("a step that fixes a roof leak says it needs dry weather, and indoor steps do not", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=kitchen");
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const leak = steps.locator(":scope > li", { hasText: "Find the moisture source" });
    await expect(leak.getByTestId("step-weather")).toContainText("Needs dry weather");
    for (const title of ["Replace the leaking valve", "Insulate and close the walls", "Hang the new ceiling"]) {
      await expect(steps.locator(":scope > li", { hasText: title }).getByTestId("step-weather")).toHaveCount(0);
    }
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `weather chip kitchen ${width}`);
  }
});
