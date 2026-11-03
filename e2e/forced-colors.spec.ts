import { test, expect, expectNoSideScroll } from "./helpers";

/**
 * Forced-colors modes (Windows High Contrast) replace every background, so controls drawn only with a fill
 * need an outline, and a pressed button needs a mark that isn't a color. /api stays blocked (helpers.ts).
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test.use({ forcedColors: "active" });

const outlineOf = (el: Element) => {
  const cs = getComputedStyle(el);
  const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth);
  return { border, outline: cs.outlineStyle !== "none" ? parseFloat(cs.outlineWidth) : 0 };
};

for (const width of [375, 768, 1280]) {
  test(`fill-only buttons keep a visible edge and a pressed button is marked (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start?view=example&ex=sanctuary");
    await expect(page.getByTestId("contrast")).toBeVisible();

    const makeYourOwn = page.getByRole("button", { name: "Make your own" });
    const edge = await makeYourOwn.evaluate(outlineOf);
    expect(edge.border + edge.outline).toBeGreaterThan(0);

    const contrast = page.getByTestId("contrast");
    await contrast.click();
    await expect(contrast).toHaveAttribute("aria-pressed", "true");
    // Move focus off the button so the focus ring doesn't stand in for the pressed mark.
    await page.mouse.click(2, 2);
    const pressed = await contrast.evaluate(outlineOf);
    expect(pressed.outline).toBeGreaterThanOrEqual(2);
    await expectNoSideScroll(page);
  });
}

test("the keyboard focus ring is a solid outline", async ({ page }) => {
  await page.goto("/start");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement as Element);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(ring.style).toBe("solid");
  expect(ring.width).toBeGreaterThanOrEqual(3);
});

test("the landing call to action keeps a visible edge", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Film a walkthrough" }).first();
  const edge = await cta.evaluate(outlineOf);
  expect(edge.border + edge.outline).toBeGreaterThan(0);
});
