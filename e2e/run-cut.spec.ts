import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * A real run whose stream is cut mid-run (the host's time limit or a lost connection) says so, and never claims
 * a small cost it can't know. /api stays blocked (helpers.ts) except the stubbed routes below.
 */
test("a cut real run says the connection dropped and that the cost count may be low", async ({ page }) => {
  await page.route("**/api/transcribe", (r) => r.fulfill({ json: { transcript: "", transcriptTurns: [] } }));
  await page.route("**/api/plan", (r) =>
    r.fulfill({ contentType: "application/x-ndjson", body: JSON.stringify({ state: "running", step: "comparing" }) + "\n" }),
  );
  await page.addInitScript(() => window.localStorage.setItem("sightwork:test-code", "stub-code"));
  await page.addInitScript(() => window.localStorage.setItem("sightwork:location", JSON.stringify({ city: "Atlanta", state: "GA" })));
  await page.goto("/start?runner=api");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "The connection dropped before the plan finished." });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  const line = page.getByTestId("failed-run-cost");
  await expect(line).toHaveText("Some AI model steps were already running when the connection dropped, so this run may still have cost something.");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(line).toBeVisible();
    await expectNoSideScroll(page);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(page, "cut run with a partial cost line");
});
