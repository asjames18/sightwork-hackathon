import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Ticks live in localStorage per plan.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("the Steps and Materials chips show progress once things are ticked, and go back to the count", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const nav = page.getByTestId("section-nav");
  const stepsChip = nav.getByRole("link", { name: /^Steps/ });
  const materialsChip = nav.getByRole("link", { name: /^Materials/ });
  await expect(nav.getByTestId("chip-progress")).toHaveCount(0);

  const steps = page.locator("#work-steps-list").getByRole("checkbox", { name: /^Step \d+ done: / });
  const totalSteps = await steps.count();
  expect(totalSteps).toBeGreaterThan(1);
  await expect(stepsChip.getByTestId("chip-count")).toHaveText(String(totalSteps));
  await steps.nth(0).check();
  await steps.nth(1).check();
  await expect(stepsChip.getByTestId("chip-progress")).toContainText(`2/${totalSteps}`);
  await expect(stepsChip).toHaveAccessibleName(new RegExp(`^Steps\\s*, 2 of ${totalSteps} done$`));
  await expect(stepsChip.getByTestId("chip-count")).toHaveCount(0);

  const items = page.getByRole("checkbox", { name: /^Got it: / });
  const totalItems = await items.count();
  expect(totalItems).toBeGreaterThan(0);
  await items.nth(0).check();
  await expect(materialsChip.getByTestId("chip-progress")).toContainText(`1/${totalItems}`);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await nav.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `chip progress ${width}`);
  }

  // Progress follows a reload, and unticking everything puts the plain count back.
  await page.reload();
  await expect(stepsChip.getByTestId("chip-progress")).toContainText(`2/${totalSteps}`);
  await steps.nth(0).uncheck();
  await steps.nth(1).uncheck();
  await expect(stepsChip.getByTestId("chip-progress")).toHaveCount(0);
  await expect(stepsChip.getByTestId("chip-count")).toHaveText(String(totalSteps));
});
