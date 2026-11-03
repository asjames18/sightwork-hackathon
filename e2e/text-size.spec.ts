import { test, expect, expectNoAxeViolations, expectNoSideScroll, openDisplaySettings } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const rootSize = (page: import("@playwright/test").Page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

test("Text size cycles Normal, Large, Extra large, scales the plan, and is kept on this device", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await openDisplaySettings(page);
  const btn = page.getByTestId("text-size");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => localStorage.removeItem("sightwork:textSize:v1"));
    await page.reload();
    await openDisplaySettings(page);
    await expect(btn).toContainText("Text size: Normal");
    const base = await rootSize(page);
    await btn.click();
    await expect(btn).toContainText("Text size: Large");
    await expect(page.getByRole("status").filter({ hasText: "Text size set to large." })).toBeAttached();
    expect(await rootSize(page)).toBeCloseTo(base * 1.15, 1);
    await expectNoSideScroll(page);
    await btn.click();
    await expect(btn).toContainText("Text size: Extra large");
    expect(await rootSize(page)).toBeCloseTo(base * 1.3, 1);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `text size ${width}`);
    // Kept: a reload comes back at the same size.
    await page.reload();
    await openDisplaySettings(page);
    await expect(btn).toContainText("Text size: Extra large");
    expect(await rootSize(page)).toBeCloseTo(base * 1.3, 1);
    // One more press goes back to normal and forgets the choice.
    await btn.click();
    await expect(btn).toContainText("Text size: Normal");
    expect(await rootSize(page)).toBeCloseTo(base, 1);
    expect(await page.evaluate(() => localStorage.getItem("sightwork:textSize:v1"))).toBeNull();
  }
});

test("Text size is left alone when the browser blocks storage, and it is not printed", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
      configurable: true,
    });
  });
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await openDisplaySettings(page);
  await page.getByTestId("text-size").click();
  await expect(page.getByTestId("text-size")).toContainText("Text size: Large");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("text-size")).toBeHidden();
});

test("Text size goes back to normal when the plan screen closes", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  const base = await rootSize(page);
  await openDisplaySettings(page);
  await page.getByTestId("text-size").click();
  expect(await rootSize(page)).toBeGreaterThan(base);
  await page.getByRole("button", { name: /^New( walkthrough)?$/ }).click();
  await expect(page.getByTestId("text-size")).toHaveCount(0);
  expect(await rootSize(page)).toBeCloseTo(base, 1);
});
