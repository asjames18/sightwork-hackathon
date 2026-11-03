import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("the real run shows its problems along the walk, and a marker jumps to its problem card", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const timeline = page.getByTestId("walk-timeline");
  await expect(timeline.getByRole("heading", { name: "Along your walk" })).toBeVisible();
  await expect(timeline.getByTestId("walk-summary")).toHaveText("6 problems spotted across the 148 s walk, 3 of them never mentioned.");
  await expect(timeline.getByTestId("walk-mark")).toHaveText(["2", "3", "5, 1", "6", "4"]);
  const mark = timeline.getByRole("link", { name: /^Problem 3: seen at 47 s, Fix now, never mentioned/ });
  await mark.click();
  await expect(page).toHaveURL(/#problem-3$/);
  await expect(page.locator("#problem-3")).toBeInViewport();
});

test("a hand-written single-photo sample has no timeline", async ({ page }) => {
  await page.goto("/start?view=example&ex=classroom");
  await expect(page.locator("#problems")).toBeVisible();
  await expect(page.getByTestId("walk-timeline")).toHaveCount(0);
});

test("the narrated kitchen sample shows where things were said and what went unsaid", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const timeline = page.getByTestId("walk-timeline");
  await expect(timeline.getByTestId("walk-summary")).toHaveText("6 problems spotted across the 45 s walk, 3 of them never mentioned.");
  await expect(timeline.getByText("Never mentioned", { exact: true })).toBeVisible();
  await expect(timeline.getByTestId("walk-said")).toHaveCount(3);
  await expect(timeline.getByText("Where you said it", { exact: true })).toBeVisible();
  await timeline.screenshot({ path: "e2e/.results/walk-timeline-kitchen.png" });
});

test("timeline fits and passes axe at 375, 768 and 1280", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    const timeline = page.getByTestId("walk-timeline");
    await timeline.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `walk timeline ${width}`);
    const box = await timeline.boundingBox();
    const marks = await timeline.getByTestId("walk-mark").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
    for (const r of marks) {
      expect(r.left).toBeGreaterThanOrEqual(box!.x);
      expect(r.right).toBeLessThanOrEqual(box!.x + box!.width);
      expect(r.width).toBeGreaterThanOrEqual(24);
    }
    // Neighbouring markers never overlap.
    for (let i = 1; i < marks.length; i++) expect(marks[i].left).toBeGreaterThanOrEqual(marks[i - 1].right);
    await timeline.screenshot({ path: `e2e/.results/walk-timeline-${width}.png` });
  }
});
