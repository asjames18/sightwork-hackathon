import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the kitchen example has 3 of 6 problems unmentioned.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("the Problems filter shows only what the narration never mentioned, and back", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const filter = page.getByTestId("unmentioned-filter");
  await expect(filter).toBeVisible();
  const all = filter.getByRole("button", { name: /^All \d+$/ });
  const only = filter.getByRole("button", { name: /^You didn.t mention \d+$/ });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  const total = Number((await all.innerText()).replace(/\D/g, ""));
  const unmentioned = Number((await only.innerText()).replace(/\D/g, ""));
  expect(unmentioned).toBeGreaterThan(0);
  expect(unmentioned).toBeLessThan(total);
  const cards = page.locator('li[id^="problem-"]');
  await expect(cards).toHaveCount(total);

  await only.click();
  await expect(only).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(unmentioned);
  for (let i = 0; i < unmentioned; i++) await expect(cards.nth(i)).toContainText("You didn't mention this");

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    // Centered, so the sticky section chips never sit on top of the walk marks above the filter while axe measures targets.
    await filter.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `unmentioned filter ${width}`);
  }

  await all.click();
  await expect(cards).toHaveCount(total);
});

test("a problem link elsewhere on the plan still lands when the filter hides that card", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const filter = page.getByTestId("unmentioned-filter");
  await filter.getByRole("button", { name: /^You didn.t mention/ }).click();
  const hidden = await page.evaluate(() => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#problem-"]')];
    const miss = links.find((a) => !document.getElementById(a.getAttribute("href")!.slice(1)));
    if (!miss) return null;
    miss.setAttribute("data-e2e-hidden-target", "1");
    return miss.getAttribute("href")!.slice(1);
  });
  test.skip(!hidden, "every linked problem is an unmentioned one in this example");
  await page.locator('[data-e2e-hidden-target="1"]').click();
  await expect(filter.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`#${hidden}`)).toBeInViewport();
  await expect(page).toHaveURL(new RegExp(`#${hidden}$`));
});

test("switching the filter from far down the list keeps it in view under the sticky chips", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=kitchen");
    const filter = page.getByTestId("unmentioned-filter");
    const only = filter.getByRole("button", { name: /^You didn.t mention/ });
    const all = filter.getByRole("button", { name: /^All/ });
    const cards = page.locator('li[id^="problem-"]');
    // Scroll so the filter sits just under the header, half-covered by the chips, then switch.
    for (const target of [only, all]) {
      await cards.last().scrollIntoViewIfNeeded();
      await filter.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 90));
      await target.evaluate((el) => (el as HTMLButtonElement).click());
      await expect(target).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const f = document.querySelector('[data-testid="unmentioned-filter"]')!.getBoundingClientRect();
            const nav = document.querySelector('[data-testid="section-nav"]')!.getBoundingClientRect();
            return f.top >= nav.bottom && f.bottom <= window.innerHeight;
          }),
        )
        .toBe(true);
    }
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `filter kept in view ${width}`);
  }
});
