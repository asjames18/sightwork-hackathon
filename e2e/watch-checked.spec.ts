import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. The kitchen example has two "Worth a closer look"
// finds; each gets a "Mark checked" toggle kept on this device.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("Mark checked ticks a closer-look find, survives a reload, and shows in the sent list", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/start?view=example&ex=kitchen");
  const watch = page.getByTestId("watch-list");
  await watch.getByText("Worth a closer look").click();
  const toggles = watch.getByTestId("watch-check");
  await expect(toggles).toHaveCount(2);
  const first = toggles.first();
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await expect(first).toHaveText("Mark checked");
  await expect(watch.getByTestId("watch-checked-summary")).toHaveCount(0);

  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(first).toHaveText("Checked");
  await expect(watch.getByTestId("watch-checked-summary")).toHaveText("1 of 2 checked in person.");
  await expect(watch.getByTestId("watch-item").first()).toHaveAttribute("data-checked", "true");

  await watch.getByTestId("send-watch").click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("\n1 of 2 checked in person.\n");
  expect(text).toMatch(/\n- [^\n]+ — checked in person\n/);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await first.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(first).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `watch checked ${width}`);
  }

  await page.reload();
  const again = page.getByTestId("watch-list");
  await expect(again.getByTestId("watch-checked-summary")).toHaveText("1 of 2 checked in person.");
  await again.getByText("Worth a closer look").click();
  await expect(again.getByTestId("watch-check").first()).toHaveAttribute("aria-pressed", "true");
  await again.getByTestId("watch-check").nth(1).click();
  await expect(again.getByTestId("watch-checked-summary")).toHaveText("Both checked in person.");
  await again.getByTestId("watch-check").first().click();
  await again.getByTestId("watch-check").nth(1).click();
  await expect(again.getByTestId("watch-checked-summary")).toHaveCount(0);
});

test("print hides the toggles and says which finds were checked", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  const watch = page.getByTestId("watch-list");
  await watch.getByText("Worth a closer look").click();
  await watch.getByTestId("watch-check").first().click();
  await page.emulateMedia({ media: "print" });
  await expect(watch.getByTestId("watch-check").first()).toBeHidden();
  await expect(watch.getByText("Checked in person", { exact: true })).toBeVisible();
});
