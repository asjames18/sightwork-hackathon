import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/** Tier headings in the Problems list show how many of their problems are fixed once steps are ticked off. */
test("ticking steps adds fixed progress to the problem tier headings", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const tags = page.locator('[data-testid^="tier-fixed-"]');
  await expect(page.getByRole("checkbox", { name: /^Step 1 done:/ })).toBeVisible();
  await expect(tags).toHaveCount(0);

  const boxes = page.locator("#steps").getByRole("checkbox", { name: /^Step \d+ done:/ });
  const total = await boxes.count();
  await page.getByRole("checkbox", { name: /^Step 1 done:/ }).check();
  await expect(tags.first()).toBeVisible();
  await expect(tags.first()).toHaveText(/· (✓ )?(\d+|all) fixed, \d+ of \d+ fixed$/);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    // Centered, so the problem filter row above it never sits half under the sticky section chips while axe runs.
    await tags.first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(tags.first()).toBeInViewport();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `tier fixed ${width}`);
  }

  for (let n = 2; n <= total; n++) await page.getByRole("checkbox", { name: new RegExp(`^Step ${n} done:`) }).check();
  const n = await tags.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await expect(tags.nth(i)).toContainText("fixed");
  await expect(page.locator('[data-testid^="tier-fixed-"]', { hasText: "all fixed" }).first()).toBeVisible();
});
