import { test, expect, WALKTHROUGH, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// Same fixtures as flow.spec.ts: /api stays blocked and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const REAL_RUN = "/start?view=example&ex=sanctuary";

/** Presses Tab until `target` has focus (at most `max` presses). */
async function tabTo(page: import("@playwright/test").Page, target: import("@playwright/test").Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`never reached ${target} with Tab`);
}

test.describe("plan screen", () => {
  test("keyboard only: Tab reaches the section chips, Enter jumps to Counts, the summary card jumps to Problems", async ({ page }) => {
    await page.goto(REAL_RUN);
    await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Plan sections" });
    const counts = nav.getByRole("link", { name: "Counts" });
    await tabTo(page, counts);
    await expect(counts).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#counts$/);
    await expect(page.locator("#counts")).toBeInViewport();

    // Back to the top: the dark summary card is one link to the problem list.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("body").focus();
    const summary = page.locator('a[href="#problems"]').first();
    await tabTo(page, summary);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#problems$/);
    await expect(page.locator("#problems")).toBeInViewport();
  });

  test("before/after slider moves with the arrow, Home and End keys", async ({ page }) => {
    await page.goto(REAL_RUN);
    const slider = page.getByRole("slider", { name: "Compare before and after" });
    await expect(slider).toHaveValue("50");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveValue("51");
    await expect(slider).toHaveAttribute("aria-valuetext", "51% before");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(slider).toHaveValue("49");
    await page.keyboard.press("End");
    await expect(slider).toHaveValue("100");
    await page.keyboard.press("Home");
    await expect(slider).toHaveValue("0");
    await expect(slider).toHaveAttribute("aria-valuetext", "0% before");
    // The before picture is clipped away entirely at 0 and fully shown at 100.
    const clip = page.locator('figure div[style*="clip-path"]').first();
    await expect(clip).toHaveAttribute("style", /inset\(0(px)? 100% 0(px)? 0(px)?\)/);
    await expectNoAxeViolations(page, "plan with the slider at 0");
  });

  test("Save PDF opens the print dialog, and the print view hides the screen-only parts", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __prints: number }).__prints = 0;
      window.print = () => {
        (window as unknown as { __prints: number }).__prints += 1;
      };
    });
    await page.goto(REAL_RUN);
    const save = page.getByRole("button", { name: "Save PDF or print this plan" });
    await expect(save).toBeVisible();
    await expect(save).toHaveText("Save PDF");
    await save.click();
    expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("navigation", { name: "Plan sections" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Make your own" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
    // The proof photos print, but their tap-to-enlarge badge is screen only.
    const photo = page.getByRole("button", { name: /^See full size: / }).first();
    await expect(photo.locator("img")).toBeVisible();
    await expect(photo.locator("span:has(svg)")).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    await expect(photo.locator("span:has(svg)")).toBeVisible();
  });
});

test("Open my last plan: after a run it shows on the landing and on /start, and reopens that plan", async ({ page }) => {
  // A fresh browser has nothing saved, so neither link shows.
  await page.goto("/start");
  await expect(page.getByRole("heading", { level: 1, name: "Film a walkthrough. Get a work plan." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open my last plan" })).toHaveCount(0);

  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await page.getByRole("button", { name: "Make my work plan" }).click();
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/");
  const landingLink = page.getByRole("link", { name: "Open my last plan" });
  await expect(landingLink).toBeVisible();
  await expectNoAxeViolations(page, "landing with a saved plan");
  await landingLink.click();
  await expect(page).toHaveURL(/\/start\?view=last$/);
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();

  await page.goto("/start");
  const button = page.getByRole("button", { name: "Open my last plan" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await expectNoSideScroll(page);
});

test.describe("not-found page", () => {
  // The browser logs the 404 response itself; that one line is expected here.
  test.use({ expectedConsoleErrors: [/status of 404/] });
  test("an unknown URL answers 404 with the branded page and both ways back in", async ({ page }) => {
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found | SightWork");
    await expect(page.getByRole("heading", { level: 1, name: "We couldn't find that page." })).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, "404");
    await page.getByRole("link", { name: "See an example plan" }).click();
    await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
    await page.goto("/no-such-page");
    await page.getByRole("link", { name: "Film a walkthrough" }).click();
    await expect(page).toHaveURL(/\/start$/);
  });
});

test("/credits lists the image sources, external links open safely", async ({ page }) => {
  const res = await page.goto("/credits");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Example image credits" })).toBeVisible();
  for (const h of ["Real run: church sanctuary stage", "Featured sample: older home kitchen renovation", "Other samples"]) {
    await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
  }
  const external = page.locator('main a[target="_blank"]');
  expect(await external.count()).toBeGreaterThan(0);
  for (const rel of await external.evaluateAll((els) => els.map((a) => a.getAttribute("rel") ?? ""))) {
    expect(rel).toContain("noopener");
  }
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "/credits");
});

test("/start links to /credits from the examples", async ({ page }) => {
  await page.goto("/start");
  await page.locator('a[href="/credits"]').first().click();
  await expect(page).toHaveURL(/\/credits$/);
  await expect(page.getByRole("heading", { level: 1, name: "Example image credits" })).toBeVisible();
});

test("/start sample cards: featured image loads first, the rest lazy from small thumbnails; Credits link is a 24 px+ target", async ({ page }) => {
  await page.goto("/start");
  const imgs = page.locator("section button img");
  await expect(imgs.first()).toHaveAttribute("loading", "eager");
  await expect(imgs.first()).toHaveAttribute("fetchpriority", "high");
  const count = await imgs.count();
  expect(count).toBeGreaterThan(1);
  for (let i = 1; i < count; i++) await expect(imgs.nth(i)).toHaveAttribute("loading", "lazy");
  for (const src of await imgs.evaluateAll((els) => els.map((e) => e.getAttribute("src") ?? "")))
    expect(src.startsWith("/examples/thumbs/") || src === "/examples/kitchen/f1.webp").toBe(true);
  const box = await page.locator('a[href="/credits"]').first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24);
});

test("plan screen: tap a proof photo to see it full size with its outline; Esc closes and focus returns", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto(REAL_RUN);
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  const open = page.getByRole("button", { name: /^See full size: / }).first();
  await open.scrollIntoViewIfNeeded();
  await open.click();
  const dialog = page.getByRole("dialog", { name: /^Proof photo: / });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  const img = dialog.locator("img");
  await expect(img).toBeVisible();
  const box = await img.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(375);
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "proof photo full view");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await open.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});
