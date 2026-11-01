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

test("Still to fix narrows the problems to the ones not fixed yet, and drops out when nothing is left", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const cards = page.locator('li[id^="problem-"]');
  await expect(cards.first()).toBeVisible();
  const filter = page.getByTestId("unmentioned-filter");
  const open = filter.getByRole("button", { name: /^Still to fix \d+$/ });
  await expect(open).toHaveCount(0);

  // Tick steps one by one until some, but not all, problems are fixed.
  const boxes = page.getByRole("checkbox", { name: /^Step \d+ done:/ });
  const total = await boxes.count();
  for (let i = 0; i < total && (await open.count()) === 0; i++) await boxes.nth(i).check();
  await expect(open).toBeVisible();

  const all = await cards.count();
  const want = Number((await open.textContent())?.match(/(\d+)\s*$/)?.[1]);
  expect(want).toBeGreaterThan(0);
  expect(want).toBeLessThan(all);
  await open.click();
  await expect(open).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(want);
  await expect(page.getByTestId("fixed-in-done")).toHaveCount(0);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await filter.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `still to fix filter ${width}`);
  }

  // Finishing every step fixes everything a step can fix; if nothing is left open the option goes and All returns.
  for (let i = 0; i < total; i++) await boxes.nth(i).check();
  const left = await open.count();
  if (left === 0) await expect(cards).toHaveCount(all);
  for (let i = 0; i < total; i++) await boxes.nth(i).uncheck();
  await expect(open).toHaveCount(0);
  await expect(cards).toHaveCount(all);
});
