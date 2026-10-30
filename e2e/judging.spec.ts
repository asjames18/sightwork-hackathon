import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// Same fixtures as flow.spec.ts: /api stays blocked and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const width of [375, 768, 1280]) {
  test(`landing at ${width}px: real-run hero, impact strip, Meta pipeline, status link`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByText("Real run", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("img", { name: /real walkthrough of a church sanctuary stage/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /no facilities staff/ })).toBeVisible();
    for (const m of ["Muse Voice Transcribe", "SAM 3.1", "Muse Spark Open", "Muse Image"]) {
      await expect(page.getByRole("heading", { name: m, exact: true })).toBeVisible();
    }
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `landing ${width}`);
  });
}

test("landing's See a real run opens the real sanctuary plan with the Powered by Meta panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See a real run" }).click();
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await expect(page.getByText("Real run", { exact: true }).first()).toBeVisible();
  const panel = page.getByRole("region", { name: "Powered by Meta AI" });
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("credits-summary")).toHaveText("3 Meta models ran: SAM 3.1, Muse Spark Open, Muse Image");
  await expect(panel).toContainText("Meta open weights, on Baseten");
  await expectNoAxeViolations(page, "real run plan");
});

test("a hand-written sample's Powered by Meta panel never claims a model ran", async ({ page }) => {
  await page.goto("/start?view=example&ex=warehouse");
  await expect(page.getByTestId("credits-summary")).toHaveText(/^Sample plan written by hand/);
  await expect(page.getByRole("region", { name: "Powered by Meta AI" }).getByText("Ran", { exact: true })).toHaveCount(0);
});

test("/status answers 200 with the config rows and no secrets, and makes no API call", async ({ page }) => {
  const res = await page.goto("/status");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Status" })).toBeVisible();
  await expect(page.getByTestId("status-summary")).toBeVisible();
  await expect(page.getByText("Plan engine: Muse Spark Open")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Always on" })).toBeVisible();
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "/status");
});

test("/start leads with the real run as the wide example card", async ({ page }) => {
  await page.goto("/start");
  const first = page.locator("#examples-heading ~ button").first();
  await expect(first).toContainText("Church sanctuary stage");
  await expect(first).toContainText("Real run");
  await first.click();
  await expect(page.getByTestId("credits-summary")).toHaveText("3 Meta models ran: SAM 3.1, Muse Spark Open, Muse Image");
});
