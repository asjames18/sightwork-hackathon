import fs from "node:fs";
import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll, WALKTHROUGH } from "./helpers";

/**
 * The cost card has a budget box that says how many steps a typed amount covers. No model calls:
 * /api/plan is answered in the browser with the real sanctuary run plus a cost range with step shares.
 */
const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));

function costedPlan() {
  const p = structuredClone(sanctuary);
  p.costRange = {
    low: 1180.5,
    high: 2643.2,
    currency: "USD",
    label: "Rough estimate, not a quote",
    region: "Sebring, FL",
    laborBasis: "mixed",
    assumptions: ["Mid-grade materials", "15% contingency on every line"],
    byStep: p.workOrder.map((s: { order: number }, i: number) => ({ order: s.order, low: [480.3, 520.1, 60, 120.1][i] ?? 0, high: [1120.8, 1120.3, 140, 262.1][i] ?? 0 })),
  };
  return p;
}

async function stubPlan(page: import("@playwright/test").Page, plan: unknown) {
  await page.route("**/api/transcribe", (r) => r.fulfill({ json: { transcript: "", transcriptTurns: [] } }));
  await page.route("**/api/plan", (r) =>
    r.fulfill({ contentType: "application/x-ndjson", body: [{ state: "running", step: "planning" }, { state: "done", plan }].map((l) => JSON.stringify(l)).join("\n") + "\n" }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem("sightwork:test-code", "stub-code");
    window.localStorage.setItem("sightwork:location", JSON.stringify({ city: "Sebring", state: "FL" }));
  });
}

test("typing a budget says what it covers, follows ticks, is kept on this device, and is hidden in print", async ({ page }) => {
  await stubPlan(page, costedPlan());
  await page.goto("/start?runner=api");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  const card = page.locator("#cost");
  await expect(card.getByTestId("send-cost")).toBeVisible({ timeout: 30_000 });
  const input = card.getByTestId("budget-input");
  const line = card.getByTestId("budget-fit-line");
  await expect(line).toHaveText("");
  await expect(card.getByLabel("Got a budget? See what it covers")).toBeVisible();

  await input.fill("1,500");
  await expect(line).toHaveText(/^\$1,500 covers step 1 even if prices come in high\./);
  await expect(line).toContainText("more.");
  expect(await page.evaluate(() => Object.entries(window.localStorage).filter(([k]) => k.endsWith(":budget")).map(([, v]) => v))).toEqual(["1,500"]);

  await input.fill("abc");
  await expect(line).toHaveText("Type the amount in dollars, like 1500.");
  await expect(input).toHaveAttribute("aria-invalid", "true");

  await input.fill("100");
  await expect(line).toHaveText(/^\$100 doesn\u2019t cover step 1 for sure/);

  await input.fill("50,000");
  await expect(line).toHaveText(/^\$50,000 covers all \d+ steps left, even if prices come in high\.$/);
  await page.getByRole("checkbox", { name: /^Step 1 done:/ }).check();
  await expect(line).toHaveText(/^\$50,000 covers all \d+ steps left/);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await input.fill("1500");
    await card.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect(line).toBeInViewport();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `budget fit ${width}`);
  }

  await page.emulateMedia({ media: "print" });
  await expect(card.getByTestId("budget-fit")).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  await input.fill("");
  await expect(line).toHaveText("");
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.endsWith(":budget")))).toEqual([]);
});

test("the sanctuary example has no step costs, so no budget box", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("checkbox", { name: /^Step 1 done:/ })).toBeVisible();
  await expect(page.getByTestId("budget-fit")).toHaveCount(0);
});
