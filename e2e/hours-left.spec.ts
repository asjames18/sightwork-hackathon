import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Step ticks live in localStorage per plan.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("ticking steps shows the hours of work left, then hides it when everything is done", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const steps = page.locator("#steps");
  await expect(steps.getByRole("heading", { name: "Do the work in this order" })).toBeVisible();
  const left = steps.getByTestId("hours-left");
  await expect(left).toHaveCount(0);

  await page.getByRole("checkbox", { name: /^Step 1 done:/ }).check();
  await expect(left).toHaveText("About 12–17 h of work left on the 3 steps not ticked yet.");

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await left.scrollIntoViewIfNeeded();
    await expect(left).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `hours left ${width}`);
  }

  await page.getByRole("checkbox", { name: /^Step 2 done:/ }).check();
  await page.getByRole("checkbox", { name: /^Step 3 done:/ }).check();
  await expect(left).toHaveText("About 6–8 h of work left on the last step.");

  await page.reload();
  await expect(steps.getByTestId("hours-left")).toHaveText("About 6–8 h of work left on the last step.");

  await page.getByRole("checkbox", { name: /^Step 4 done:/ }).check();
  await expect(steps.getByTestId("hours-left")).toHaveCount(0);
});
