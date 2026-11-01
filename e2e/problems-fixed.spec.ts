import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Ticks live in localStorage per plan.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("ticking off work steps fills the problems fixed tally, and clearing them hides it", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const tally = page.getByTestId("problems-fixed");
  await expect(page.locator('li[id^="problem-"]').first()).toBeVisible();
  await expect(tally).toHaveCount(0);

  const boxes = page.getByRole("checkbox", { name: /^Step \d+ done:/ });
  await boxes.first().check();
  await expect(tally).toBeVisible();
  await expect(tally).toContainText(/\d+ of \d+ problems? fixed|All \d+ problems fixed|Problem fixed/);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await tally.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `problems fixed tally ${width}`);
  }

  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
  await expect(tally).toContainText(/All \d+ problems fixed|Problem fixed/);
  await expect(tally).toContainText("Every step that fixes them is done.");

  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).uncheck();
  await expect(tally).toHaveCount(0);
});
