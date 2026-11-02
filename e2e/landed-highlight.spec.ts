import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Landing cue: a problem card or work step reached from a link on the plan lights up briefly
 * (a still outline with reduced motion), so the eye lands on the right card after the jump.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const landing = (el: Element) => {
  const cs = getComputedStyle(el);
  return { animation: cs.animationName, outline: cs.outlineStyle };
};

for (const width of [375, 768, 1280]) {
  test(`a jumped-to problem card and step light up (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start?view=example");
    await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });

    const link = page.getByTestId("summary-titles").getByRole("link").nth(1);
    const href = (await link.getAttribute("href")) as string;
    const card = page.locator(href);
    expect((await card.evaluate(landing)).animation).toBe("none");
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    expect((await card.evaluate(landing)).animation).toBe("sw-landed");

    // A step reached from a problem card's "Fixed in step N" link gets the same cue.
    const stepLink = page.locator('a[href^="#step-"]').first();
    const stepHref = (await stepLink.getAttribute("href")) as string;
    await stepLink.click();
    await expect(page).toHaveURL(new RegExp(`${stepHref}$`));
    await expect(page.locator(stepHref)).toBeInViewport();
    expect((await page.locator(stepHref).evaluate(landing)).animation).toBe("sw-landed");
    // Only the current target lights up.
    expect((await card.evaluate(landing)).animation).toBe("none");

    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `landed highlight (${width} px)`);
  });
}

test("reduced motion gets a still outline instead of the glow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/start?view=example");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });
  const link = page.getByTestId("summary-titles").getByRole("link").first();
  const href = (await link.getAttribute("href")) as string;
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  expect(await page.locator(href).evaluate(landing)).toEqual({ animation: "none", outline: "solid" });
});
