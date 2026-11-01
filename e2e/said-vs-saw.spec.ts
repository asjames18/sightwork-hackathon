import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the kitchen example has 3 matched and 3 unmentioned rows.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("said vs saw rows carry a tally, a tag per row and a link to the problem", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const section = page.locator("#said-vs-saw");
  await expect(section).toBeVisible();
  await expect(section.getByTestId("said-vs-saw-tally")).toHaveText("3 matched, 3 you didn't mention.");
  const rows = section.getByTestId("said-vs-saw-row");
  await expect(rows).toHaveCount(6);
  await expect(section.locator('[data-kind="unmentioned"]')).toHaveCount(3);
  await expect(section.locator('[data-kind="unmentioned"]').first()).toContainText("You didn't mention");
  await expect(section.locator('[data-kind="matched"]').first()).toContainText("Matched");

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await section.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `said vs saw ${width}`);
  }

  const link = section.locator('[data-kind="unmentioned"]').first().getByRole("link", { name: /^Problem \d+$/ });
  const rank = (await link.innerText()).replace(/\D/g, "");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`#problem-${rank}$`));
  await expect(page.locator(`#problem-${rank}`)).toBeInViewport();
});
