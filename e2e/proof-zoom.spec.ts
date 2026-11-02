import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("full-size proof photo: Zoom in enlarges around the outline, Zoom out puts it back, and it resets on reopen", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  const open = page.getByRole("button", { name: /^See full size: / }).first();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await open.scrollIntoViewIfNeeded();
    await open.click();
    const dialog = page.getByRole("dialog", { name: /^Proof photo: / });
    await expect(dialog).toBeVisible();
    const zoom = dialog.getByTestId("proof-zoom-toggle");
    const layer = dialog.getByTestId("proof-zoom-layer");
    await expect(zoom).toHaveAccessibleName("Zoom in");
    await expect(zoom).toHaveAttribute("aria-pressed", "false");
    const before = await layer.boundingBox();
    await zoom.click();
    await expect(zoom).toHaveAccessibleName("Zoom out");
    await expect(zoom).toHaveAttribute("aria-pressed", "true");
    await expect(layer).toHaveAttribute("data-zoomed", "true");
    await expect(dialog.getByTestId("proof-outline-status")).toHaveText(/^Zoomed in [\d.]+ times on the outline\.$/);
    // The layer is drawn larger than before; its frame clips it, so the page never scrolls sideways.
    await expect.poll(async () => (await layer.boundingBox())!.width).toBeGreaterThan(before!.width * 1.4);
    // The outline is still on the zoomed photo.
    await expect(layer.locator("span.border-accent")).toHaveCount(1);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `proof zoom ${width}`);
    await zoom.click();
    await expect(zoom).toHaveAccessibleName("Zoom in");
    await expect(dialog.getByTestId("proof-outline-status")).toHaveText("Zoomed out. The whole photo is in view.");
    await zoom.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // Reopening starts zoomed out again.
    await open.click();
    await expect(dialog).toBeVisible();
    await expect(layer).toHaveAttribute("data-zoomed", "false");
    await expect(zoom).toHaveAccessibleName("Zoom in");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  }
});
