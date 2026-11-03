import { test, expect, expectNoAxeViolations, expectNoSideScroll, openDisplaySettings } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const width of [375, 768, 1280]) {
  test(`plan header keeps pace, text size and contrast in one closed box (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
    // Closed by default: the header shows Send, Read it to me and the one box.
    const box = page.getByTestId("display-settings");
    await expect(box).toBeVisible();
    expect(await box.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await expect(page.getByTestId("text-size")).toBeHidden();
    await expect(page.getByTestId("contrast")).toBeHidden();
    await expect(page.getByRole("button", { name: /^Send to your team/ })).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `display box closed ${width}`);
    // The summary opens it from the keyboard and every button is inside.
    await box.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("text-size")).toBeVisible();
    await expect(page.getByTestId("contrast")).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `display box open ${width}`);
  });
}

test("the display box is left out of print", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await openDisplaySettings(page);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("display-settings")).toBeHidden();
});
