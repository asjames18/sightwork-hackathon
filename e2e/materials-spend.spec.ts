import fs from "node:fs";
import path from "node:path";
import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Materials list shows a rough spend for what's still needed when the plan carries per-item prices.
 * /api stays blocked (helpers.ts) except the stubbed routes below; prices are made up for the check.
 */
const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));
const shotDir = process.env.SHOT_DIR;

const PRICES: Record<number, [number, number]> = { 0: [20, 35], 2: [25, 40], 3: [90, 150], 6: [45, 70] };

test("real run with prices: the list shows what the materials still to buy cost, and ticking updates it", async ({ page }) => {
  const plan = {
    ...sanctuary,
    meta: { ...sanctuary.meta, isExample: undefined },
    materials: sanctuary.materials.map((m: Record<string, unknown>, i: number) => (PRICES[i] ? { ...m, unitCost: PRICES[i] } : m)),
  };
  await page.route("**/api/transcribe", (r) => r.fulfill({ json: { transcript: "", transcriptTurns: [] } }));
  await page.route("**/api/plan", (r) =>
    r.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ state: "done", plan }) + "\n" }),
  );
  await page.addInitScript(() => window.localStorage.setItem("sightwork:test-code", "stub-code"));
  await page.goto("/start?runner=api");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  const card = page.getByRole("group", { name: "Your walkthrough" });
  await card.getByLabel("City").fill("Atlanta");
  await card.getByLabel("State").selectOption("GA");
  await card.getByRole("button", { name: "Make my work plan" }).click();
  const spend = page.getByTestId("materials-spend");
  await expect(spend).toBeVisible({ timeout: 30_000 });
  // 3 pieces x 20-35, 2 x 25-40, 2 sets x 90-150, 2 gallons x 45-70 = 380-625; 4 of 8 items unpriced.
  await expect(spend).toHaveText(
    "Materials to buy: about $380–$625 for 4 items, materials only. 4 more have no price yet. Rough estimate, not a quote.",
  );
  await page.getByLabel("Got it: Handrail kits for stage steps").check();
  await expect(spend).toContainText("Still to buy: about $200–$325 for 3 items");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(spend).toBeVisible();
    await expectNoSideScroll(page);
  }
  // Scroll to the top first: a row that sits under the sticky section nav mid-scroll reads as an obscured target to axe.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(page, "materials list with a spend line");
  if (shotDir && test.info().project.name === "phone-390") {
    fs.mkdirSync(shotDir, { recursive: true });
    await page.setViewportSize({ width: 375, height: 900 });
    await spend.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shotDir, "materials-spend-375.png") });
  }
});

test("example plans have no prices, so no spend line", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await expect(page.getByTestId("materials-spend")).toHaveCount(0);
});
