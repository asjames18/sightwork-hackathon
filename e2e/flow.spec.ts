import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect, WALKTHROUGH, SHORT_CLIP } from "./helpers";

// Every test uses both fixtures, so /api stays blocked and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const UPLOAD_H1 = "Film a walkthrough. Get a work plan.";

async function expectNoAxeViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(violations.map((v) => `${v.id} (${v.nodes.length})`), `axe on ${label}`).toEqual([]);
}

async function expectNoSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("landing opens the upload screen with the filming tips", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoAxeViolations(page, "landing");
  await page.getByRole("link", { name: "Film a walkthrough" }).first().click();
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole("heading", { level: 1, name: UPLOAD_H1 })).toBeVisible();

  const tips = page.getByRole("region", { name: "How to film" });
  await expect(tips).toBeVisible();
  await expect(tips.getByRole("listitem")).toHaveCount(6);
  for (const t of ["Walk slowly", "Lights on", "Stay 3 to 6 feet from walls", "Cover each area once", "Name each area", "Point out problems"]) {
    await expect(tips.getByText(t, { exact: false })).toBeVisible();
  }
  await expect(tips).toContainText("1 to 2 feet");
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "/start");
});

test("landing's example link opens the example plan", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See an example plan" }).first().click();
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await expect(page.getByText(/^(Real run|Sample)$/).first()).toBeVisible();
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "example plan");
});

test("an example card on /start opens its plan, and Make your own comes back", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: /Warehouse floor/ }).click();
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await expect(page.getByText("Sample", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Make your own" }).click();
  await expect(page.getByRole("heading", { level: 1, name: UPLOAD_H1 })).toBeVisible();
});

test("deep link /start?view=example renders the plan in the first HTML", async ({ page, request }) => {
  const html = await (await request.get("/start?view=example&ex=sanctuary")).text();
  expect(html).toContain("Problems, worst first");
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByText("Real run", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
});

test("upload a video (mock runner): processing screen, then the plan", async ({ page }) => {
  await page.goto("/start");
  await page.locator('input[type="file"]').setInputFiles(WALKTHROUGH);
  const card = page.getByRole("group", { name: "Your walkthrough" });
  await expect(card).toContainText("walkthrough-6s.webm");
  await expect(card).toContainText("0:06");
  await expect(card).toContainText("your video stays on this device");
  const make = page.getByRole("button", { name: "Make my work plan" });
  await expect(make).toBeEnabled();
  await make.click();

  await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Plan progress" })).toBeVisible();
  await expectNoAxeViolations(page, "processing");

  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/your video .walkthrough-6s\.webm. was not sent anywhere/)).toBeVisible();
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "plan after a mock run");
});

test("a clip under 5 seconds is blocked before anything runs", async ({ page }) => {
  await page.goto("/start");
  await page.locator('input[type="file"]').setInputFiles(SHORT_CLIP);
  await expect(page.getByRole("alert").filter({ hasText: "only a few seconds" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Make my work plan" })).toBeDisabled();
});

test("real-run mode without a tester code stops at once and sends nothing", async ({ page }) => {
  await page.goto("/start?runner=api");
  const code = page.getByLabel("Tester code for real runs");
  await expect(code).toBeVisible();
  await expect(code).toHaveValue("");
  await expect(page.getByText("Real runs use paid model credits, so they need a code.")).toBeVisible();
  await expectNoAxeViolations(page, "/start?runner=api");

  await page.locator('input[type="file"]').setInputFiles(WALKTHROUGH);
  await expect(page.getByText("Frames and narration are sent to make your plan.")).toBeVisible();
  await page.getByRole("button", { name: "Make my work plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "We couldn't finish your plan" })).toBeVisible();
  await expect(page.getByText(/Real runs need a tester code/)).toBeVisible();
  // The apiCalls fixture then checks that no /api request left the browser.
});

test("the server gate answers 401 to an API call with no tester code", async ({ request }) => {
  // Body is deliberately empty: even past the gate it would be rejected before any model call.
  const res = await request.post("/api/plan", { data: {} });
  expect(res.status()).toBe(401);
  expect(res.headers()["cache-control"]).toContain("no-store");
});

test("a step failure (?fail=planning) shows the error card, and Try again runs it again", async ({ page }) => {
  await page.goto("/start?fail=planning");
  await page.locator('input[type="file"]').setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "We couldn't finish your plan" })).toBeVisible({ timeout: 30_000 });
  const retry = page.getByRole("button", { name: "Try again" });
  await expect(retry).toBeFocused();
  await expectNoAxeViolations(page, "failure card");
  await retry.click();
  await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toBeVisible();
});

test("?mock=nometa: SAM and the after picture show as skipped, the plan still comes back", async ({ page }) => {
  await page.goto("/start?mock=nometa");
  await page.locator('input[type="file"]').setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  // Looking and Counting flip to skipped once Comparing starts (the step state is announced as text).
  await expect(page.getByText(/skipped this run/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Off this run").first()).toBeVisible();
  // The stand-in plan is hand-written, so its frames don't promise outlines.
  await expect(page.getByText(/coming soon/i)).toHaveCount(0);
});
