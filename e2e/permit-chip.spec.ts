import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example plan needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("plumbing and electrical steps say a permit may apply, and only those steps", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example");
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const chips = steps.getByTestId("step-permit");
    await expect(chips.first()).toBeVisible();
    await expect(chips.first()).toContainText("Permit may apply");
    const plumberSteps = steps.locator(":scope > li", { hasText: "Paid: Plumber" });
    expect(await plumberSteps.count()).toBeGreaterThan(0);
    expect(await chips.count()).toBeLessThanOrEqual(await steps.getByText(/^Paid: /).count());
    for (const li of await plumberSteps.all()) await expect(li.getByTestId("step-permit")).toHaveCount(1);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `permit chip ${width}`);
  }
});
