import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("a material's problem numbers link up to their problem cards", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const section = page.locator("#materials");
  const link = section.getByTestId("material-for").getByRole("link").first();
  await expect(link).toBeVisible();
  const label = (await link.getAttribute("aria-label")) ?? "";
  const rank = Number(label.replace("Go to problem ", ""));
  expect(Number.isInteger(rank) && rank > 0).toBe(true);
  await expect(link).toHaveAttribute("href", `#problem-${rank}`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`#problem-${rank}$`));
  await expect(page.locator(`#problem-${rank}`)).toBeInViewport();
});

test("material problem links fit and pass axe at 375, 768 and 1280", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    const section = page.locator("#materials");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByTestId("material-for").first()).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `materials problem links ${width}`);
  }
});
