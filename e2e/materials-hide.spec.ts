import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Shopping list ticks live in localStorage per plan.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("Hide the ones in hand shows only what's left, and Show all brings them back", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const list = page.locator("#materials");
  const boxes = list.getByRole("checkbox", { name: /^Got it: / });
  const total = await boxes.count();
  expect(total).toBeGreaterThan(2);
  await expect(list.getByTestId("materials-hide-got")).toHaveCount(0);

  await boxes.nth(0).check();
  await boxes.nth(1).check();
  const toggle = list.getByTestId("materials-hide-got");
  await expect(toggle).toHaveText("Hide the 2 in hand");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveText("Show all items");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(list.getByTestId("materials-hidden-line")).toHaveText("2 in hand hidden.");
  await expect(list.locator("#materials-list > li:visible")).toHaveCount(total - 2);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await list.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `materials hide ${width}`);
  }

  // Ticking another while hidden tucks it away too.
  await list.locator("#materials-list > li:visible").first().getByRole("checkbox").check();
  await expect(toggle).toHaveText("Show all items");
  await expect(list.locator("#materials-list > li:visible")).toHaveCount(total - 3);

  await toggle.click();
  await expect(list.locator("#materials-list > li:visible")).toHaveCount(total);
  await expect(list.getByTestId("materials-hidden-line")).toHaveCount(0);
});

test("paper lists every item even while the ones in hand are hidden", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const list = page.locator("#materials");
  const boxes = list.getByRole("checkbox", { name: /^Got it: / });
  const total = await boxes.count();
  await boxes.nth(0).check();
  await list.getByTestId("materials-hide-got").click();
  await page.emulateMedia({ media: "print" });
  await expect(list.locator("#materials-list > li:visible")).toHaveCount(total);
  await expect(list.getByTestId("materials-hide-got")).toBeHidden();
});
