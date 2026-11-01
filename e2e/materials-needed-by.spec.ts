import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const WHEN = String.raw`(Mon|Tue|Wed|Thu|Fri), \w{3} \d{1,2}, \d{1,2}(:\d{2})? (AM|PM)`;

test("materials say which step needs them first and when", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const section = page.locator("#materials");
  await expect(section.getByTestId("materials-buy-first")).toHaveText(new RegExp(`^Buy first: \\d+ items? for step \\d+, which starts ${WHEN}\\.$`));
  const lines = section.getByTestId("material-needed-by");
  expect(await lines.count()).toBeGreaterThan(0);
  await expect(lines.first()).toHaveText(new RegExp(`^Needed by step \\d+, ${WHEN}$`));
  // Ticking an item off hides its line.
  const before = await lines.count();
  const firstItem = section.locator("li").filter({ has: page.getByTestId("material-needed-by") }).first();
  await firstItem.getByRole("checkbox").check();
  await expect(lines).toHaveCount(before - 1);
});

test("needed-by lines fit and pass axe at 375, 768 and 1280", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    const section = page.locator("#materials");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByTestId("materials-buy-first")).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `materials needed-by ${width}`);
    await section.screenshot({ path: `e2e/.results/materials-needed-by-${width}.png` });
  }
});
