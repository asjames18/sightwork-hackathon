import fs from "node:fs";
import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll, WALKTHROUGH } from "./helpers";

/**
 * The cost card says how much of the range is still ahead once work steps are ticked off. No model calls:
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

test("ticking steps shows what is still to spend on the cost card, then hides it when everything is done", async ({ page }) => {
  await stubPlan(page, costedPlan());
  await page.goto("/start?runner=api");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  const card = page.locator("#cost");
  await expect(card.getByTestId("send-cost")).toBeVisible({ timeout: 30_000 });
  const left = card.getByTestId("cost-left");
  await expect(left).toHaveText("");

  const boxes = page.locator("#steps").getByRole("checkbox", { name: /^Step \d+ done:/ });
  const total = await boxes.count();
  expect(total).toBeGreaterThan(2);
  await page.getByRole("checkbox", { name: /^Step 1 done:/ }).check();
  await expect(left).toHaveText(new RegExp(`^About \\$[\\d,]+–\\$[\\d,]+ of this is for the ${total - 1} steps not ticked yet\\.$`));

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await card.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect(left).toBeInViewport();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `cost left ${width}`);
  }

  for (let n = 2; n < total; n++) await page.getByRole("checkbox", { name: new RegExp(`^Step ${n} done:`) }).check();
  await expect(left).toHaveText(/^(About \$[\d,]+(–\$[\d,]+)? of this is for|Nothing left to spend on) the last step\.$/);

  await page.emulateMedia({ media: "print" });
  await expect(left).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  await page.getByRole("checkbox", { name: new RegExp(`^Step ${total} done:`) }).check();
  await expect(left).toHaveText("");
});

test("a sample with no step costs has no line; the priced real run says what is left", async ({ page }) => {
  await page.goto("/start?view=example&ex=office");
  await page.getByRole("checkbox", { name: /^Step 1 done:/ }).check();
  await expect(page.getByTestId("cost-left")).toHaveCount(0);
  await page.goto("/start?view=example&ex=sanctuary");
  await page.getByRole("checkbox", { name: /^Step 1 done:/ }).check();
  await expect(page.getByTestId("cost-left")).toHaveText("About $240–$421 of this is for the 5 steps not ticked yet.");
});
