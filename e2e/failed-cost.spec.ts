import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * A real run that stops says what its model calls already cost (the failed line's costUsd).
 * /api stays blocked (helpers.ts) except the stubbed routes below; the amount is made up for the check.
 */
test("a stopped real run shows what it billed; one with nothing billed shows no cost line", async ({ page }) => {
  let costUsd: number | undefined = 0.21;
  await page.route("**/api/transcribe", (r) => r.fulfill({ json: { transcript: "", transcriptTurns: [] } }));
  await page.route("**/api/plan", (r) =>
    r.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ state: "failed", step: "comparing", message: "Stub stop for the test.", ...(costUsd ? { costUsd } : {}) }) + "\n",
    }),
  );
  await page.addInitScript(() => window.localStorage.setItem("sightwork:test-code", "stub-code"));
  await page.addInitScript(() => window.localStorage.setItem("sightwork:location", JSON.stringify({ city: "Atlanta", state: "GA" })));
  await page.goto("/start?runner=api");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Stub stop for the test." });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  const line = page.getByTestId("failed-run-cost");
  await expect(line).toHaveText("The AI model calls before it stopped cost about 21 cents.");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(line).toBeVisible();
    await expectNoSideScroll(page);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(page, "stopped run with a cost line");

  costUsd = undefined;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(line).toHaveCount(0);
});
