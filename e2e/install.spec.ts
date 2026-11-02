import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Add to home screen: the pages link a web app manifest and a 180 px touch icon, and both are served.
 * /api stays blocked (helpers.ts); nothing here reaches a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

for (const path of ["/", "/start"]) {
  test(`${path} links the manifest and the home-screen icon`, async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).toBeTruthy();
    const touchHref = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute("href");
    expect(touchHref).toBeTruthy();

    const res = await request.get(manifestHref!);
    expect(res.ok()).toBeTruthy();
    const m = await res.json();
    expect(m.start_url).toBe("/start");
    expect(m.display).toBe("standalone");
    expect((m.shortcuts ?? []).map((x: { url: string }) => x.url)).toEqual(["/start", "/start?view=last", "/start?view=example"]);

    const icon = await request.get(touchHref!);
    expect(icon.ok()).toBeTruthy();
    expect(icon.headers()["content-type"]).toContain("image/png");
    await expectNoSideScroll(page);
  });
}

for (const width of [375, 768, 1280]) {
  test(`start page still clean with the install tags (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start");
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `start with install tags (${width} px)`);
  });
}
