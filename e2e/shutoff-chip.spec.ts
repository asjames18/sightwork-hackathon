import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example plan needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("plumbing steps say to shut the water off first, and finish work does not", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example");
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const plumberSteps = steps.locator(":scope > li", { hasText: "Paid: Plumber" });
    expect(await plumberSteps.count()).toBeGreaterThan(0);
    for (const li of await plumberSteps.all()) await expect(li.getByTestId("step-shutoff")).toContainText("Water off first");
    const drywall = steps.locator(":scope > li", { hasText: "Paid: Drywall crew" });
    expect(await drywall.count()).toBeGreaterThan(0);
    for (const li of await drywall.all()) await expect(li.getByTestId("step-shutoff")).toHaveCount(0);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `shut-off chip ${width}`);
  }
});
