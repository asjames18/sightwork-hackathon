import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Step ticks live in localStorage per plan.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("crew rows follow the step ticks: how many done, which step is next, then All done", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const card = page.locator("#steps").getByTestId("crew-summary");
  await expect(card).toBeVisible();
  const plumber = card.getByTestId("crew-row").filter({ has: page.getByRole("button", { name: "Send Plumber their steps" }) });
  await expect(plumber).toHaveCount(1);
  await expect(card.getByTestId("crew-progress")).toHaveCount(0);

  await page.getByRole("checkbox", { name: /^Step 2 done:/ }).check();
  const chip = plumber.getByTestId("crew-progress");
  await expect(chip).toContainText("1 of 2 done, next step 3");
  await expect(card.getByTestId("crew-progress")).toHaveCount(1);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await card.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `crew progress ${width}`);
  }

  await page.getByRole("checkbox", { name: /^Step 3 done:/ }).check();
  await expect(chip).toContainText("All done");
  await expect(chip).toHaveAttribute("title", "Plumber: every step is ticked off as done.");

  await page.reload();
  await expect(card.getByTestId("crew-row").filter({ has: page.getByRole("button", { name: "Send Plumber their steps" }) }).getByTestId("crew-progress")).toContainText("All done");
  await card.scrollIntoViewIfNeeded();
  await expectNoAxeViolations(page, "crew progress all done");

  await page.locator("#steps").getByRole("button", { name: "Clear ticks" }).click();
  await expect(card.getByTestId("crew-progress")).toHaveCount(0);
});
