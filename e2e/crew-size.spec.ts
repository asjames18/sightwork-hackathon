import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("crew size stepper turns the total hours into hours each", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    const box = page.locator("#steps").getByTestId("crew-size");
    await box.scrollIntoViewIfNeeded();
    const line = box.getByTestId("crew-size-line");
    await expect(box.getByTestId("crew-size-count")).toHaveText("2");
    await expect(line).toContainText("2 people: about 7–10 h each, roughly 2 working days.");
    await box.getByTestId("crew-size-more").click();
    await expect(line).toContainText("3 people: about 4.5–6.5 h each, roughly 1 working day.");
    await box.getByTestId("crew-size-less").click();
    await box.getByTestId("crew-size-less").click();
    await expect(line).toContainText("1 person: about 14–20 h, roughly 3 working days.");
    await expect(box.getByTestId("crew-size-less")).toBeDisabled();
    for (let i = 0; i < 11; i++) await box.getByTestId("crew-size-more").click();
    await expect(box.getByTestId("crew-size-count")).toHaveText("12");
    await expect(box.getByTestId("crew-size-more")).toBeDisabled();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `crew size ${width}`);
  }
});

test("crew size is not printed", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("crew-size")).toBeHidden();
});
