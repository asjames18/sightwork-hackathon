import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Each work step says whether the materials it
// needs are in hand, following the shopping list ticks live.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("work steps follow the shopping list ticks", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/start?view=example&ex=kitchen");
  const chips = page.getByTestId("step-materials");
  await expect(chips.first()).toBeVisible();
  const count = await chips.count();
  for (let i = 0; i < count; i++) await expect(chips.nth(i)).toHaveText(/^Needs \d+ items?\./);

  const boxes = page.getByRole("checkbox", { name: /^Got it: / });
  const n = await boxes.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
  for (let i = 0; i < count; i++) await expect(chips.nth(i)).toHaveText(/^(Materials|Item) in hand\. Everything this step needs is in hand\.$/);

  // The step that owns the first chip sends its Bring list with every item marked in hand.
  const step = page.locator('li[id^="step-"]').filter({ has: page.getByTestId("step-materials") }).first();
  await step.getByTestId("send-step").click();
  await expect(step.getByRole("status")).toHaveText(/Copied/);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const bring = text.split("\n").filter((l) => l.startsWith("- "));
  expect(bring.length).toBeGreaterThan(0);
  for (const l of bring) expect(l.endsWith(" (in hand)")).toBe(true);

  // Untick one item: at least one step is back to waiting on it, and it survives a reload.
  await boxes.first().uncheck();
  await expect(chips.filter({ hasText: /Still to buy for this step/ })).not.toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("step-materials").filter({ hasText: /Still to buy for this step/ })).not.toHaveCount(0);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.getByTestId("step-materials").first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `step materials ${width}`);
  }
});
