import { readFile } from "node:fs/promises";
import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test; the stored sanctuary run needs no model.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("Add to calendar downloads the work steps as a .ics file starting the next workday", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  const card = page.getByTestId("step-calendar");
  await expect(card.getByTestId("step-calendar-summary")).toHaveText(/^Starts (Mon|Tue|Wed|Thu|Fri), \w{3} \d{1,2}, 9 AM; \d+ workdays?, 9 to 5\.$/);
  const [download] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Add to calendar" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^sightwork-steps-\d{4}-\d{2}-\d{2}\.ics$/);
  const ics = (await readFile((await download.path())!, "utf8")).replace(/\r\n /g, "");
  const steps = await page.locator("#steps ol > li").count();
  expect(steps).toBeGreaterThan(0);
  expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
  expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThanOrEqual(steps);
  expect(ics).toMatch(/SUMMARY:Step 1: /);
  expect(ics).toMatch(/DTSTART:\d{8}T090000\r\n/);
  await expect(card.getByRole("status")).toHaveText(/^Saved sightwork-steps-.*\.ics\. Open it to add the steps to your calendar\.$/);
});

test("calendar card fits and passes axe at 375, 768 and 1280", async ({ page }) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/start?view=example&ex=sanctuary");
    const card = page.getByTestId("step-calendar");
    await card.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `step calendar ${width}`);
    const btn = await card.getByRole("button", { name: "Add to calendar" }).boundingBox();
    expect(btn!.height).toBeGreaterThanOrEqual(44);
    await card.screenshot({ path: `e2e/.results/step-calendar-${width}.png` });
  }
});
