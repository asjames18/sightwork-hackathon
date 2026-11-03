import { test, expect, WALKTHROUGH } from "./helpers";

/**
 * With "reduce motion" on, nothing on the processing screen spins or pulses. With it off, the current step
 * still shows its spinner and pulse, so the check can tell the two apart.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

async function runningAnimations(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running" && (a.effect as KeyframeEffect | null)?.target?.closest("ol"))
      .map((a) => (a as CSSAnimation).animationName ?? "unnamed"),
  );
}

for (const [mode, reduced] of [["reduce", true], ["no-preference", false]] as const) {
  test(`processing: motion with ${mode}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: mode });
    await page.goto("/start");
    await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
    await page.getByRole("button", { name: "Make my work plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toBeVisible();
    await expect(page.locator("ol [aria-current='step']")).toBeVisible();
    const names = await runningAnimations(page);
    if (reduced) expect(names, "no step animation under reduced motion").toEqual([]);
    else expect(names.length, "the current step animates when motion is allowed").toBeGreaterThan(0);
  });
}
