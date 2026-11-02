import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("full-size proof photo: Hide outline shows what is under the box, and the outline is back next time", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  const open = page.getByRole("button", { name: /^See full size: / }).first();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await open.scrollIntoViewIfNeeded();
    await open.click();
    const dialog = page.getByRole("dialog", { name: /^Proof photo: / });
    await expect(dialog).toBeVisible();
    const outline = dialog.locator("span.border-accent");
    const toggle = dialog.getByTestId("proof-outline-toggle");
    await expect(outline).toHaveCount(1);
    await expect(toggle).toHaveAccessibleName("Hide outline");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(outline).toHaveCount(0);
    await expect(toggle).toHaveAccessibleName("Show outline");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByTestId("proof-outline-status")).toHaveText("Outline hidden. The whole photo is in view.");
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `proof outline toggle ${width}`);
    await toggle.click();
    await expect(outline).toHaveCount(1);
    await toggle.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // Reopening starts with the outline shown again.
    await open.click();
    await expect(dialog).toBeVisible();
    await expect(outline).toHaveCount(1);
    await expect(toggle).toHaveAccessibleName("Hide outline");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  }
});
