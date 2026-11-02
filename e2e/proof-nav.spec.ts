import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("full-size proof photo: Previous / Next and arrow keys step through the problem photos", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  const triggers = page.locator('[data-proof-group="problems"]');
  const count = await triggers.count();
  expect(count).toBeGreaterThan(1);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const first = triggers.first();
    await first.scrollIntoViewIfNeeded();
    await first.click();
    let dialog = page.locator("dialog[open]");
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByTestId("proof-nav-pos")).toHaveText(`Photo 1 of ${count}`);
    await expect(dialog.getByRole("button", { name: "Previous photo" })).toBeDisabled();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `proof nav ${width}`);
    await dialog.getByRole("button", { name: "Next photo" }).click();
    dialog = page.locator("dialog[open]");
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByTestId("proof-nav-pos")).toHaveText(`Photo 2 of ${count}`);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("dialog[open]").getByTestId("proof-nav-pos")).toHaveText(`Photo 1 of ${count}`);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("dialog[open]").getByTestId("proof-nav-pos")).toHaveText(`Photo 2 of ${count}`);
    // Step to the last one: Next is off there, no wrap.
    for (let i = 2; i < count; i++) await page.locator("dialog[open]").getByRole("button", { name: "Next photo" }).click();
    dialog = page.locator("dialog[open]");
    await expect(dialog.getByTestId("proof-nav-pos")).toHaveText(`Photo ${count} of ${count}`);
    await expect(dialog.getByRole("button", { name: "Next photo" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    // Focus lands on the last photo's own button, so the page is at that problem.
    await expect(triggers.nth(count - 1)).toBeFocused();
  }
});
