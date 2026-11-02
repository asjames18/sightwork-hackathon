import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// The Before and after slider plays one short sweep hint the first time it comes into view, unless the
// visitor asked for reduced motion. Any key, touch or click stops it and puts the divider back in the middle.
const SANCTUARY = "/start?view=example&ex=sanctuary";

async function sliderValues(page: import("@playwright/test").Page, ms: number): Promise<number[]> {
  return page.evaluate(async (wait) => {
    const el = document.querySelector<HTMLInputElement>('input[aria-label="Compare before and after"]')!;
    const seen: number[] = [];
    const end = performance.now() + wait;
    while (performance.now() < end) {
      seen.push(Number(el.value));
      await new Promise((r) => setTimeout(r, 50));
    }
    return seen;
  }, ms);
}

for (const width of [375, 768, 1280]) {
  test(`the slider sweeps once and settles in the middle (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(SANCTUARY);
    const slider = page.getByRole("slider", { name: "Compare before and after" });
    await slider.scrollIntoViewIfNeeded();
    const seen = await sliderValues(page, 3500);
    expect(Math.max(...seen)).toBeGreaterThan(65);
    expect(Math.min(...seen)).toBeLessThan(35);
    await expect(slider).toHaveValue("50");
    // It only plays once: scrolling away and back leaves it still.
    await page.evaluate(() => window.scrollTo(0, 0));
    await slider.scrollIntoViewIfNeeded();
    const again = await sliderValues(page, 1500);
    expect(new Set(again)).toEqual(new Set([50]));
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `plan after the before/after sweep (${width} px)`);
  });
}

test("a key press mid-sweep stops it and returns to the middle", async ({ page }) => {
  await page.goto(SANCTUARY);
  const slider = page.getByRole("slider", { name: "Compare before and after" });
  await slider.scrollIntoViewIfNeeded();
  await expect.poll(async () => Number(await slider.inputValue()), { timeout: 5000 }).not.toBe(50);
  await slider.focus();
  await expect(slider).toHaveValue("50");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("51");
  const after = await sliderValues(page, 1500);
  expect(new Set(after)).toEqual(new Set([51]));
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the slider stays still", async ({ page }) => {
    await page.goto(SANCTUARY);
    const slider = page.getByRole("slider", { name: "Compare before and after" });
    await slider.scrollIntoViewIfNeeded();
    const seen = await sliderValues(page, 3000);
    expect(new Set(seen)).toEqual(new Set([50]));
  });
});
