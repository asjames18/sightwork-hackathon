import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Summary card links: each problem named on the dark summary card opens that problem's own card;
 * the stats row still opens the problem list.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const width of [375, 768, 1280]) {
  test(`summary card problems link to their own cards (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start?view=example");
    await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });
    const list = page.getByTestId("summary-titles");
    const links = list.getByRole("link");
    expect(await links.count()).toBeGreaterThan(1);
    // No link inside a link: the old card was one big link.
    expect(await page.locator("a a").count()).toBe(0);

    const second = links.nth(1);
    const href = await second.getAttribute("href");
    expect(href).toMatch(/^#problem-\d+$/);
    await expect(second).toHaveAccessibleName(/^Problem \d+: \S/);
    const box = await second.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
    await second.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator(href as string)).toBeInViewport();

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('a[href="#problems"]').first().click();
    await expect(page).toHaveURL(/#problems$/);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `summary card links (${width} px)`);
  });
}
