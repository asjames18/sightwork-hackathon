import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Ticks live in localStorage per plan.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("Clear ticks on the work steps offers Undo that puts the same ticks back", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const steps = page.locator("#steps");
  await page.getByRole("checkbox", { name: /^Step 2 done:/ }).check();
  await page.getByRole("checkbox", { name: /^Step 3 done:/ }).check();

  await steps.getByRole("button", { name: "Clear ticks" }).click();
  await expect(page.getByRole("checkbox", { name: /^Step 2 done:/ })).not.toBeChecked();
  await expect(steps.getByText("Cleared 2 ticked steps.")).toBeVisible();
  const undo = steps.getByRole("button", { name: "Undo: tick the 2 steps again" });
  await expect(undo).toBeFocused();

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await undo.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoAxeViolations(page, `clear ticks undo ${width}`);
  }

  await undo.click();
  await expect(page.getByRole("checkbox", { name: /^Step 2 done:/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Step 3 done:/ })).toBeChecked();
  await expect(steps.getByRole("button", { name: "Clear ticks" })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /^Step 3 done:/ })).toBeChecked();

  // A new tick after a clear starts fresh: Undo goes away.
  await steps.getByRole("button", { name: "Clear ticks" }).click();
  await page.getByRole("checkbox", { name: /^Step 1 done:/ }).check();
  await expect(steps.getByTestId("clear-ticks-undo")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /^Step 2 done:/ })).not.toBeChecked();
});

test("Clear ticks on the shopping list offers Undo", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const list = page.locator("#materials");
  const first = list.getByRole("checkbox", { name: /^Got it: / }).first();
  await first.check();
  await list.getByRole("button", { name: "Clear ticks" }).click();
  await expect(first).not.toBeChecked();
  await expect(list.getByText("Cleared 1 ticked item.")).toBeVisible();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoSideScroll(page);
  }
  await list.getByRole("button", { name: "Undo: tick the item again" }).click();
  await expect(first).toBeChecked();
  await page.reload();
  await expect(list.getByRole("checkbox", { name: /^Got it: / }).first()).toBeChecked();
});
