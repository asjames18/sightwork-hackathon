import fs from "node:fs";
import path from "node:path";
import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Powered by Meta panel says what the model calls for a real plan cost (plan.meta.costUsd).
 * /api stays blocked (helpers.ts) except the stubbed routes below; the total is made up for the check.
 */
const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));

test("real run: the Powered by Meta panel shows the run's model cost", async ({ page }) => {
  const plan = { ...sanctuary, meta: { ...sanctuary.meta, isExample: undefined, costUsd: 0.94 } };
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
  const line = page.getByTestId("run-cost");
  await expect(line).toBeVisible({ timeout: 30_000 });
  await expect(line).toHaveText("The AI model calls for this plan cost about 94 cents.");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(line).toBeVisible();
    await expectNoSideScroll(page);
  }
  // Scroll to the top first: a row that sits under the sticky section nav mid-scroll reads as an obscured target to axe.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(page, "powered by meta panel with a run cost");
});

test("the real Hope City example shows the cost recorded on its run; samples show none", async ({ page }) => {
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByTestId("run-cost")).toHaveText("The AI model calls for this plan cost about 38 cents.");
  await page.goto("/start?view=example&ex=kitchen");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await expect(page.getByTestId("run-cost")).toHaveCount(0);
});
