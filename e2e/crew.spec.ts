import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("work order opens with who does the work: paid trades, then volunteers, and a total", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const steps = page.locator("#steps");
  await expect(steps.getByRole("heading", { name: "Do the work in this order" })).toBeVisible();

  const card = steps.getByTestId("crew-summary");
  await expect(card.getByRole("heading", { name: "Who does the work" })).toBeVisible();
  const rows = card.getByTestId("crew-row");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Paid");
  await expect(rows.nth(0)).toContainText("Electrician / AV tech");
  await expect(rows.nth(0)).toContainText("Step 1, about 2–3 h");
  await expect(rows.nth(3)).toContainText("Free");
  await expect(rows.nth(3)).toContainText("Volunteers");
  await expect(rows.nth(3)).toContainText("Step 3, about 2–3 h");
  await expect(card.getByTestId("crew-total")).toHaveText("All 4 steps: about 14–20 h of work in total, before any waiting between steps.");

  await card.scrollIntoViewIfNeeded();
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "crew summary");
});
