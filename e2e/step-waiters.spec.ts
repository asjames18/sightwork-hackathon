import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("a step that others wait on says so, on screen and in Send this step", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/start?view=example&ex=kitchen");
  const step3 = page.locator("#step-3");
  const chip = step3.getByTestId("step-waiters");
  await expect(chip).toContainText("Step 4 waits on this");
  await expect(chip).toHaveAttribute("title", "Step 4 can't start until this step is done.");

  // The last step holds nothing up, so it has no chip.
  await expect(page.locator('li[id^="step-"]').last().getByTestId("step-waiters")).toHaveCount(0);

  await step3.getByTestId("send-step").click();
  await expect(step3.getByRole("status")).toHaveText(/Copied/);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("When this is done, step 4 (Find the moisture source) can start.");

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await chip.evaluate((el) => el.scrollIntoView({ block: "end" }));
    await expect(chip).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `step waiters ${width}`);
  }
});
