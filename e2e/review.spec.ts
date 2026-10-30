import fs from "node:fs";
import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll, WALKTHROUGH } from "./helpers";

/**
 * Step checks and the reviewer pass, UI side. No model calls: the examples carry a precomputed review, the mock
 * runner streams check notes, and the "real run" case answers /api/transcribe and /api/plan from a stub in the browser.
 */

const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));

test("featured example: precomputed proof check line, no Unverified badge (every problem has a proof photo)", async ({ page }) => {
  await page.goto("/start?view=example");
  await expect(page.getByText(/^Proof check for this example: 6 of 6 problems backed by a photo\./)).toBeVisible();
  await expect(page.getByText("Unverified", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Worked out ahead of time for this example")).toBeVisible();
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "featured example with review line");
});

test("mock run: each finished step shows its check, and Reviewing is the last step", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  const list = page.getByRole("list").filter({ hasText: "Reviewing" });
  await expect(list).toBeVisible();
  await expect(page.getByText("Step 1 of 8", { exact: true })).toBeVisible();
  await expect(list.getByText(/^Checked:/).first()).toBeVisible({ timeout: 10_000 });
  await expect(list.getByText(/Plan: 6 problems, each with a proof frame/)).toBeVisible({ timeout: 15_000 });
  if (process.env.REVIEW_SHOT_DIR) await page.screenshot({ path: path.join(process.env.REVIEW_SHOT_DIR, `processing-checks-${page.viewportSize()?.width}.png`), fullPage: true });
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "processing with check notes");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });
});

test("real-run shape (stubbed API): Unverified badge with its reason, review line, PDF keeps both", async ({ page }) => {
  // Problems 1-3 carry real reviewer answers from the Oct 30 measurement on this plan; problem 4 is set unverified here only to show the badge.
  const review = {
    ran: true,
    source: "model",
    items: [
      { problemId: "1", verified: true, reason: "Photo C shows coiled cables tangled unsecured on stage floor near Roland keyboard creating trip hazard." },
      { problemId: "2", verified: true, reason: "Photo C shows coiled cables exposed on floor near Roland keyboard without cable covers or protectors." },
      { problemId: "3", verified: true, reason: "Photo A shows both left and right stage steps with metal skirting and no handrails or ramp visible." },
      { problemId: "4", verified: false, reason: "Test stub: no attached photo shows the tissue box on the stage lip." },
    ],
  };
  const lines = [
    { state: "running", step: "listening", check: { ok: true, note: "Transcript: 92 words" } },
    { state: "running", step: "reviewing" },
    { state: "running", step: "reviewing", check: { ok: false, note: "3 of 4 problems backed by a photo" } },
    { state: "done", plan: { ...sanctuary, review } },
  ];
  await page.route("**/api/transcribe", (r) => r.fulfill({ json: { transcript: "[0.0] Stage check.", transcriptTurns: [{ startSec: 0, text: "Stage check." }] } }));
  await page.route("**/api/plan", (r) => r.fulfill({ contentType: "application/x-ndjson", body: lines.map((l) => JSON.stringify(l)).join("\n") + "\n" }));
  await page.addInitScript(() => window.localStorage.setItem("sightwork:test-code", "stub-code"));
  await page.goto("/start?runner=api");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();

  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Reviewed by a separate check: 3 of 4 problems backed by a photo.")).toBeVisible();
  const card4 = page.getByRole("listitem").filter({ hasText: "Worn, dirty stage floor" });
  await expect(card4.getByText("Unverified", { exact: true })).toBeVisible();
  await expect(card4.getByText(/Not backed by a photo: Test stub/)).toBeVisible();
  await expect(page.getByText("Unverified", { exact: true })).toHaveCount(1);
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "plan with an Unverified badge");
  const shotDir = process.env.REVIEW_SHOT_DIR;
  if (shotDir) {
    // Review line and the Unverified card in one picture: cards 2 and 3 are hidden for the screenshot only.
    const w = page.viewportSize()?.width ?? 0;
    await page.evaluate(() => document.querySelectorAll("img").forEach((i) => (i.loading = "eager")));
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelectorAll<HTMLElement>("#problems ol > li").forEach((li, k) => { if (k === 1 || k === 2) li.style.display = "none"; }));
    const top = await page.getByText(/^Reviewed by a separate check/).boundingBox();
    const card = await page.locator("#problems ol > li").nth(3).boundingBox();
    if (top && card) await page.screenshot({ path: path.join(shotDir, `plan-badge-${w}.png`), fullPage: true, clip: { x: 0, y: top.y - 70, width: w, height: card.y + card.height - top.y + 90 } });
    await page.evaluate(() => document.querySelectorAll<HTMLElement>("#problems ol > li").forEach((li) => (li.style.display = "")));
  }
  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Reviewed by a separate check: 3 of 4 problems backed by a photo.")).toBeVisible();
  await expect(card4.getByText("Unverified", { exact: true })).toBeVisible();
});
