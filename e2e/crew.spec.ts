import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("work order opens with who does the work: paid trades, then volunteers, and a total", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const steps = page.locator("#steps");
  await expect(steps.getByRole("heading", { name: "Do the work in this order" })).toBeVisible();

  const card = steps.getByTestId("crew-summary");
  await expect(card.getByRole("heading", { name: "Who does the work" })).toBeVisible();
  const rows = card.getByTestId("crew-row");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Paid");
  await expect(rows.nth(0)).toContainText("Electrician / AV tech");
  await expect(rows.nth(0)).toContainText("Step 1, about 2–3 h");
  await expect(rows.nth(3)).toContainText("Free");
  await expect(rows.nth(3)).toContainText("Volunteers");
  await expect(rows.nth(3)).toContainText("Step 3, about 2–3 h");
  await expect(card.getByTestId("crew-total")).toHaveText("All 4 steps: about 14–20 h of work in total, before any waiting between steps.");

  await card.scrollIntoViewIfNeeded();
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "crew summary");
});

test("each crew row sends just that crew's steps and materials", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    const card = page.locator("#steps").getByTestId("crew-summary");
    await card.scrollIntoViewIfNeeded();
    const send = card.getByRole("button", { name: "Send Electrician / AV tech their steps" });
    await expect(send).toBeVisible();
    await expect(card.getByTestId("crew-send")).toHaveCount(4);
    await send.click();
    await expect(card.getByText("Copied. Paste it into a text.")).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^Electrician \/ AV tech: your part of the work plan for /);
    expect(text).toContain("Step 1. ");
    expect(text).toContain("this list is step 1 only.");
    expect(text).toContain("Made with SightWork");
    await expectNoSideScroll(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoAxeViolations(page, `crew send ${width}`);
  }
});
