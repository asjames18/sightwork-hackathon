import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Processing screen "What your plan will have": desktop shows the While you wait panel beside the steps;
 * phones and tablets get the same list folded under the step list, closed until tapped.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const width of [375, 768, 1280]) {
  test(`processing: what the plan will have (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start");
    await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
    await page.getByRole("button", { name: "Make my work plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toBeVisible();
    const compact = page.getByTestId("while-you-wait-compact");
    if (width >= 1024) {
      await expect(page.getByRole("heading", { name: "While you wait" })).toBeVisible();
      await expect(compact).toBeHidden();
    } else {
      await expect(page.getByRole("heading", { name: "While you wait" })).toBeHidden();
      await expect(compact).toBeVisible();
      await expect(compact.getByText("A materials list")).toBeHidden();
      await compact.getByText("What your plan will have").click();
      await expect(compact.getByText("Problems ranked by priority, including ones you didn't mention")).toBeVisible();
      await expect(compact.getByText("A materials list")).toBeVisible();
    }
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `processing what the plan will have (${width} px)`);
  });
}
