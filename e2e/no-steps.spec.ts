import fs from "node:fs";
import path from "node:path";
import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * A real plan that came back with problems but no work steps: the steps section says the fixes weren't laid out
 * (never "nothing needs fixing") and the cost card says there was nothing to price (never "try again").
 * /api stays blocked (helpers.ts) except the stubbed routes below.
 */
const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));

test("problems with no work steps get honest steps and cost lines", async ({ page }) => {
  const plan = {
    ...sanctuary,
    workOrder: [],
    costRange: null,
    meta: { ...sanctuary.meta, isExample: undefined, region: "Atlanta, GA", skipped: { ...(sanctuary.meta?.skipped ?? {}), cost: true } },
  };
  expect(plan.issues.length).toBeGreaterThan(0);
  expect(plan.materials.length).toBeGreaterThan(0);
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

  const steps = page.locator("#steps");
  await expect(steps).toContainText("This run didn’t lay out work steps", { timeout: 30_000 });
  await expect(steps).not.toContainText("nothing needs fixing");
  const cost = page.getByRole("region", { name: "What it might cost" }).or(page.locator("section", { hasText: "What it might cost" }).last());
  await expect(cost).toContainText("No cost range, since there are no work steps to price.");
  await expect(cost).not.toContainText("try again");

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await steps.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `no work steps ${width}`);
  }
});
