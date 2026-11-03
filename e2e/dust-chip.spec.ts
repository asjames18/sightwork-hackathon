import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example plan needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("a drywall step says to bring eye and dust protection, and a valve step does not", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example");
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const ceiling = steps.locator(":scope > li", { hasText: "Hang the new ceiling" });
    await expect(ceiling.getByTestId("step-dust")).toContainText("Eyes and dust mask");
    const valve = steps.locator(":scope > li", { hasText: "Replace the leaking valve" });
    await expect(valve.getByTestId("step-dust")).toHaveCount(0);
    // The lead and asbestos chip already covers the dust on tear-out steps, so the two never stack.
    const tearOut = steps.locator(":scope > li", { hasText: "Make the ceiling safe" });
    await expect(tearOut.getByTestId("step-dust")).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `dust chip ${width}`);
  }
});
