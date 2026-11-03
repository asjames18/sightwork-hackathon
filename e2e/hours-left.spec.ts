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
  await expect(left).toHaveText("About 6.5–11.5 h of work left on the 5 steps not ticked yet.");

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    // Step 1 to the top (its scroll margin clears the sticky chips), so no control above sits half under them while axe runs.
    await page.locator("#step-1").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect(left).toBeAttached();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `hours left ${width}`);
  }

  for (const n of [2, 3, 4, 5]) await page.getByRole("checkbox", { name: new RegExp(`^Step ${n} done:`) }).check();
  await expect(left).toHaveText("About 1–2 h of work left on the last step.");

  await page.reload();
  await expect(steps.getByTestId("hours-left")).toHaveText("About 1–2 h of work left on the last step.");

  await page.getByRole("checkbox", { name: /^Step 6 done:/ }).check();
  await expect(steps.getByTestId("hours-left")).toHaveCount(0);
});
