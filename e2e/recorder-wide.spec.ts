import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Recorder wide view: a camera that can zoom out below 1x (an ultra-wide lens) gets a Wide view /
 * Normal view button that asks the track for its widest zoom and back; a camera without one shows no
 * button. The fake camera has no zoom, so these tests make the video track report one and record
 * what the page asks for.
 */
test.beforeEach(async ({ apiCalls, pageErrors, context }) => {
  void apiCalls;
  void pageErrors;
  await context.grantPermissions(["camera", "microphone"]);
});

const fakeZoom = (withTorch: boolean) => {
  const w = window as unknown as { __zoom: unknown[] };
  w.__zoom = [];
  const proto = MediaStreamTrack.prototype;
  const caps = proto.getCapabilities;
  proto.getCapabilities = function (this: MediaStreamTrack) {
    const c = caps.call(this);
    if (this.kind !== "video") return c;
    return withTorch ? { ...c, zoom: { min: 0.5, max: 8, step: 0.1 }, torch: true } : { ...c, zoom: { min: 0.5, max: 8, step: 0.1 } };
  } as typeof proto.getCapabilities;
  const settings = proto.getSettings;
  proto.getSettings = function (this: MediaStreamTrack) {
    const s = settings.call(this);
    return this.kind === "video" ? { ...s, zoom: 1 } : s;
  } as typeof proto.getSettings;
  const apply = proto.applyConstraints;
  proto.applyConstraints = function (this: MediaStreamTrack, c?: MediaTrackConstraints) {
    const adv = c?.advanced?.[0] as { zoom?: number; torch?: boolean } | undefined;
    if (this.kind === "video" && adv && ("zoom" in adv || "torch" in adv)) {
      if ("zoom" in adv) w.__zoom.push(adv.zoom);
      return Promise.resolve();
    }
    return apply.call(this, c);
  };
};

for (const width of [375, 768, 1280]) {
  test(`recorder: wide view button (${width} px)`, async ({ page }) => {
    await page.addInitScript(fakeZoom, true);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start");
    await page.getByRole("button", { name: "Record a walkthrough" }).click();
    const cam = page.getByRole("group", { name: "Camera" });
    await expect(cam).toHaveAttribute("data-phase", "ready");
    const wide = cam.getByTestId("wide-toggle");
    await expect(wide).toHaveText("Wide view (0.5x)");
    await expect(wide).toHaveAttribute("aria-pressed", "false");
    await expect(cam.getByTestId("torch-toggle")).toBeVisible();
    await expectNoSideScroll(page);
    await wide.click();
    await expect(wide).toHaveText("Normal view");
    await expect(wide).toHaveAttribute("aria-pressed", "true");
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `recorder wide on (${width} px)`);

    await cam.getByRole("button", { name: "Start recording" }).click();
    await expect(cam).toHaveAttribute("data-phase", "recording");
    await expect(wide).toBeVisible();
    await wide.click();
    await expect(wide).toHaveText("Wide view (0.5x)");
    expect(await page.evaluate(() => (window as unknown as { __zoom: unknown[] }).__zoom)).toEqual([0.5, 1]);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `recorder recording with wide view (${width} px)`);
    await cam.getByRole("button", { name: "Cancel" }).click();
  });
}

test("recorder: no wide view button when the camera can't zoom out", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const cam = page.getByRole("group", { name: "Camera" });
  await expect(cam).toHaveAttribute("data-phase", "ready");
  await expect(cam.getByTestId("wide-toggle")).toHaveCount(0);
  await cam.getByRole("button", { name: "Cancel" }).click();
});

test("recorder: on a 320x568 phone with light and wide view, every button is 44 px tall and nothing scrolls sideways", async ({ page }) => {
  await page.addInitScript(fakeZoom, true);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/start");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const cam = page.getByRole("group", { name: "Camera" });
  await expect(cam).toHaveAttribute("data-phase", "ready");
  for (const id of ["wide-toggle", "torch-toggle"]) {
    const box = await cam.getByTestId(id).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await expectNoSideScroll(page);
  await cam.getByRole("button", { name: "Cancel" }).click();
});
