import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Step ticks live in localStorage per plan.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("Next up shows after the first tick, names the next ready step, ticks it from the card, then says done", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  await expect(page.locator("#steps")).toBeVisible();
  await expect(page.getByTestId("next-up")).toHaveCount(0);

  await page.getByRole("checkbox", { name: /^Step 2 done:/ }).check();
  const card = page.getByTestId("next-up");
  await expect(card).toHaveAttribute("data-kind", "next");
  await expect(card.getByTestId("next-up-progress")).toHaveText("1 of 8 steps done.");
  await expect(card.getByTestId("next-up-step")).toContainText("Make the ceiling safe");
  await expect(card.getByTestId("next-up-facts")).toContainText("Paid: Demo crew · About 3-6 h");
  await expect(card.getByTestId("next-up-also")).toHaveText("1 other step can start now too.");

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await card.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `next up ${width}`);
  }

  await card.getByRole("button", { name: "Mark step 1 done" }).click();
  await expect(page.getByRole("checkbox", { name: /^Step 1 done:/ })).toBeChecked();
  await expect(card.getByTestId("next-up-step")).toContainText("Replace the rusty drain lines");
  await expect(card.getByTestId("next-up-progress")).toHaveText("2 of 8 steps done.");

  await page.reload();
  await expect(page.getByTestId("next-up").getByTestId("next-up-step")).toContainText("Replace the rusty drain lines");

  for (const o of [3, 4, 5, 6, 7, 8]) await page.getByRole("checkbox", { name: new RegExp(`^Step ${o} done:`) }).check();
  await expect(page.getByTestId("next-up")).toHaveAttribute("data-kind", "all");
  await expect(page.getByTestId("next-up-progress")).toContainText("All 8 steps done.");
  await page.getByTestId("next-up").scrollIntoViewIfNeeded();
  await expectNoAxeViolations(page, "next up all done");

  await page.locator("#steps").getByRole("button", { name: "Clear ticks" }).click();
  await expect(page.getByTestId("next-up")).toHaveCount(0);
});
