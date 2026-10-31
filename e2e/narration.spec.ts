import fs from "node:fs";
import path from "node:path";
import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * A real run whose transcribe call failed (meta.skipped.transcribe) must not tell the person their video had
 * no narration. /api stays blocked (helpers.ts) except the browser stubs below; nothing reaches a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));

async function runWith(page: import("@playwright/test").Page, skipped: Record<string, boolean>) {
  const plan = {
    ...sanctuary,
    transcript: null,
    transcriptTurns: [],
    transcriptSummary: undefined,
    saidVsSeen: [],
    meta: { ...sanctuary.meta, isExample: undefined, skipped },
  };
  await page.route("**/api/transcribe", (r) => r.fulfill({ json: { transcript: "", transcriptTurns: [] } }));
  await page.route("**/api/plan", (r) =>
    r.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ state: "done", plan }) + "\n" }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem("sightwork:test-code", "stub-code");
    window.localStorage.setItem("sightwork:location", JSON.stringify({ city: "Sebring", state: "FL" }));
  });
  await page.goto("/start?runner=api");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("group", { name: "Your walkthrough" }).getByRole("button", { name: "Make my work plan" }).click();
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });
}

test("transcribe failed: the plan says the narration couldn't be transcribed, not that there was none", async ({ page }) => {
  await runWith(page, { transcribe: true });
  await expect(page.getByText("We couldn't transcribe the narration this run", { exact: false })).toBeVisible();
  await expect(page.getByText("narration not transcribed", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("No narration in this video", { exact: false })).toHaveCount(0);
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "plan after a failed transcribe call");
});

test("a silent video keeps the no-narration note", async ({ page }) => {
  await runWith(page, {});
  await expect(page.getByText("No narration in this video", { exact: false })).toBeVisible();
  await expect(page.getByText("couldn't transcribe", { exact: false })).toHaveCount(0);
});
