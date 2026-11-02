import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Step ticks live in localStorage per plan.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("Hide the done steps shows only what's left, and Show all brings them back", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const list = page.locator("#work-steps-list");
  const boxes = list.getByRole("checkbox", { name: /^Step \d+ done: / });
  const total = await boxes.count();
  expect(total).toBeGreaterThan(2);
  await expect(page.getByTestId("steps-hide-done")).toHaveCount(0);

  await boxes.nth(0).check();
  await boxes.nth(1).check();
  const toggle = page.getByTestId("steps-hide-done");
  await expect(toggle).toHaveText("Hide the 2 done");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveText("Show all steps");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("steps-hidden-line")).toHaveText("2 done steps hidden.");
  await expect(list.locator("> li:visible")).toHaveCount(total - 2);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await list.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `steps hide ${width}`);
  }

  // Ticking another while hidden tucks it away too.
  await list.locator("> li:visible").first().getByRole("checkbox").check();
  await expect(list.locator("> li:visible")).toHaveCount(total - 3);

  await toggle.click();
  await expect(list.locator("> li:visible")).toHaveCount(total);
  await expect(page.getByTestId("steps-hidden-line")).toHaveCount(0);
});

test("a link to a hidden done step shows every step again and lands on it", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const list = page.locator("#work-steps-list");
  await list.getByRole("checkbox", { name: /^Step 1 done: / }).check();
  await page.getByTestId("steps-hide-done").click();
  await expect(page.locator("#step-1")).toBeHidden();
  await page.evaluate(() => {
    const a = document.createElement("a");
    a.href = "#step-1";
    a.textContent = "to step 1";
    document.body.appendChild(a);
    a.click();
  });
  await expect(page.locator("#step-1")).toBeVisible();
  await expect(page.getByTestId("steps-hide-done")).toHaveText("Hide the 1 done");
});

test("paper lists every step even while the done ones are hidden", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const list = page.locator("#work-steps-list");
  const total = await list.locator("> li").count();
  await list.getByRole("checkbox", { name: /^Step 1 done: / }).check();
  await page.getByTestId("steps-hide-done").click();
  await page.emulateMedia({ media: "print" });
  await expect(list.locator("> li:visible")).toHaveCount(total);
  await expect(page.getByTestId("steps-hide-done")).toBeHidden();
});
