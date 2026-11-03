import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * When a page throws while it runs, the visitor gets a plain message with Try again and two ways back in, not a
 * bare browser error. The failure is forced here by making the plan title's length rounding throw until the test lets it
 * work again; nothing reaches /api or a model. Console errors are not asserted: React logs the failure on purpose.
 */
test.beforeEach(async ({ apiCalls }) => {
  void apiCalls;
});

async function breakDuration(page: import("@playwright/test").Page) {
  // The example plan's title row rounds its 45 s length; making that one call throw fails the page while it renders.
  await page.addInitScript(() => {
    const w = window as unknown as { __swBreak: boolean };
    w.__swBreak = true;
    const real = Math.round;
    Math.round = (n: number) => {
      if (w.__swBreak && n === 45) throw new Error("forced failure");
      return real(n);
    };
  });
}

for (const width of [375, 768, 1280]) {
  test(`a page that throws shows the message and Try again brings the plan back (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await breakDuration(page);
    await page.goto("/start?view=example");

    const panel = page.getByTestId("error-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByRole("heading", { name: "This page hit a problem." })).toBeFocused();
    await expect(panel).toContainText("Nothing you saved was lost");
    await expect(page.getByRole("link", { name: "Back to the start" })).toHaveAttribute("href", "/start");
    await expect(page.getByRole("link", { name: "See an example plan" })).toHaveAttribute("href", "/start?view=example");
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `error page ${width}`);

    await page.evaluate(() => {
      (window as unknown as { __swBreak: boolean }).__swBreak = false;
    });
    await page.getByTestId("error-retry").click();
    await expect(page.getByTestId("error-panel")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
}

test("the error message stays out of the way on a normal page", async ({ page }) => {
  await page.goto("/start?view=example");
  await expect(page.getByTestId("error-panel")).toHaveCount(0);
});
