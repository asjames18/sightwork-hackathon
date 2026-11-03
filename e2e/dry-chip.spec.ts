import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored example plans need no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("a step that paints says it needs time to dry, and a step that only cleans does not", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const rows = steps.locator(":scope > li");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const text = ((await row.innerText()) ?? "").toLowerCase();
      const chips = await row.getByTestId("step-dry").count();
      // Any step whose title says it paints must carry the chip, and a chip never sits on a step with no wet product at all.
      if (/\b(prime and paint|and paint the|paint the)\b/.test(text)) expect(chips).toBe(1);
      if (chips) expect(text).toMatch(/paint|prime|caulk|grout|mortar|plaster|patch|concrete|seal|stain|varnish|epoxy|compound|mud/);
      if (/deep-clean the carpet|clear the main aisle/.test(text)) expect(chips).toBe(0);
    }
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `dry chip ${width}`);
  }
});

test("the kitchen plan's prime, paint and trim step carries the chip", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=kitchen");
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const paint = steps.locator(":scope > li", { hasText: "Prime, paint and trim" });
    await expect(paint.getByTestId("step-dry")).toContainText("Needs time to dry");
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `dry chip kitchen ${width}`);
  }
});
