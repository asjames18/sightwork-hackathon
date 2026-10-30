import fs from "node:fs";
import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// Chromium runs with --use-fake-device-for-media-stream / --use-fake-ui-for-media-stream (see
// playwright.config.ts): a synthetic camera picture and a beep, permission auto-accepted.
// Optional: REC_SHOTS=<dir> saves screenshots of the recorder; REC_OUT=<dir> saves what was recorded.
test.beforeEach(async ({ apiCalls, pageErrors, context }) => {
  void apiCalls;
  void pageErrors;
  await context.grantPermissions(["camera", "microphone"]);
});

const SHOTS = process.env.REC_SHOTS;
const OUT = process.env.REC_OUT;

/** Keeps every stream getUserMedia hands out on window, so a test can check the tracks were stopped. */
const trackStreams = () => {
  const w = window as unknown as { __streams: MediaStream[] };
  w.__streams = [];
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    const s = await orig(c);
    w.__streams.push(s);
    return s;
  };
};
/** Keeps every MediaRecorder on window, so a test can read the bitrate it was set up with. */
const trackRecorders = () => {
  const w = window as unknown as { __recorders: MediaRecorder[] };
  w.__recorders = [];
  const Orig = window.MediaRecorder;
  class Spy extends Orig {
    constructor(stream: MediaStream, options?: MediaRecorderOptions) {
      super(stream, options);
      w.__recorders.push(this);
    }
  }
  window.MediaRecorder = Spy;
};
const liveTrackCount = () =>
  (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === "live").length;

test("Record: in-page camera at the requested size, a 6 s take, then the plan (mock runner)", async ({ page }, info) => {
  await page.addInitScript(trackStreams);
  await page.addInitScript(trackRecorders);
  await page.goto("/start");
  await expect(page.getByTestId("choose-video-input")).not.toHaveAttribute("capture");
  await expect(page.getByTestId("camera-app-input")).toHaveAttribute("capture", "environment");
  await expect(page.getByText("For the sharpest video, record in your Camera app and choose it here.")).toBeVisible();

  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const cam = page.getByRole("group", { name: "Camera" });
  await expect(cam).toHaveAttribute("data-phase", "ready");
  await expect(cam.getByTestId("recording-resolution")).toContainText(/Camera ready at \d+×\d+/);
  const width = Number(await cam.getAttribute("data-width"));
  const height = Number(await cam.getAttribute("data-height"));
  // The fake camera honours the ideal 1920x1080 request.
  expect([width, height]).toEqual([1920, 1080]);
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "camera ready");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `recorder-ready-${info.project.name}.png`) });

  await cam.getByRole("button", { name: "Start recording" }).click();
  await expect(cam.getByTestId("recording-resolution")).toContainText("Recording at 1920×1080");
  await page.waitForTimeout(3000);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `recorder-recording-${info.project.name}.png`) });
  await page.waitForTimeout(3300);
  await cam.getByRole("button", { name: "Stop recording" }).click();

  const card = page.getByRole("group", { name: "Your walkthrough" });
  await expect(card).toContainText(/walkthrough-\d{4}-\d{2}-\d{2}-\d{4}\.(webm|mp4)/);
  await expect(card).toContainText("0:06");
  await expect(card.getByTestId("recorded-at")).toContainText("Recorded here at 1920×1080");
  expect(await page.evaluate(liveTrackCount), "camera and mic are released after stop").toBe(0);

  // What actually got recorded: decoded size and average bitrate of the file.
  const rec = await page.evaluate(async () => {
    const v = document.querySelector<HTMLVideoElement>('[aria-label="Your walkthrough"] video')!;
    const blob = await (await fetch(v.src)).blob();
    return { bytes: blob.size, type: blob.type, videoWidth: v.videoWidth, videoHeight: v.videoHeight, duration: v.duration };
  });
  const mbps = (rec.bytes * 8) / rec.duration / 1e6;
  expect(rec.videoWidth).toBe(1920);
  expect(rec.videoHeight).toBe(1080);
  // The recorder was set up at 8 Mbps (Chromium's default is 2.5). The fake camera's picture is a
  // near-static test card, so the encoder needs far less than that and the file comes out small;
  // the target is a ceiling for busy real footage, not a fixed rate.
  const recorder = await page.evaluate(() => {
    const r = (window as unknown as { __recorders: MediaRecorder[] }).__recorders.at(-1)!;
    return { videoBitsPerSecond: r.videoBitsPerSecond, audioBitsPerSecond: r.audioBitsPerSecond, mimeType: r.mimeType };
  });
  expect(recorder.videoBitsPerSecond).toBe(8_000_000);
  expect(mbps).toBeGreaterThan(0);
  expect(mbps).toBeLessThan(12);
  const label = (await card.getByTestId("recorded-at").textContent()) ?? "";
  if (OUT) fs.writeFileSync(path.join(OUT, `recorded-${info.project.name}.json`), JSON.stringify({ ...rec, mbps, label, recorder }, null, 2));
  await expectNoAxeViolations(page, "recorded take");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `recorder-done-${info.project.name}.png`) });

  const make = page.getByRole("button", { name: "Make my work plan" });
  await expect(make).toBeEnabled();
  await make.click();
  await expect(page.getByRole("heading", { level: 1, name: "Working on your plan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible({ timeout: 30_000 });
});

test("Record, then Cancel: back to the picker and the camera is released", async ({ page }) => {
  await page.addInitScript(trackStreams);
  await page.goto("/start");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const cam = page.getByRole("group", { name: "Camera" });
  await expect(cam).toHaveAttribute("data-phase", "ready");
  await cam.getByRole("button", { name: "Start recording" }).click();
  await page.waitForTimeout(1200);
  await cam.getByRole("button", { name: "Cancel" }).click();
  await expect(cam).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record a walkthrough" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Your walkthrough" })).toHaveCount(0);
  expect(await page.evaluate(liveTrackCount)).toBe(0);
});

test("Record when the camera is blocked: plain message, camera app and Choose a video offered", async ({ page }, info) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));
  });
  await page.goto("/start");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const note = page.getByRole("alert").filter({ hasText: "Camera or microphone access was blocked" });
  await expect(note).toBeVisible();
  await expect(note.getByRole("button", { name: "Open the camera app" })).toBeVisible();
  await expect(note.getByRole("button", { name: "Choose a video" })).toBeVisible();
  await expectNoAxeViolations(page, "camera blocked");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `recorder-blocked-${info.project.name}.png`) });
  // The fallback opens the capture="environment" picker (the phone's camera app).
  const chooser = page.waitForEvent("filechooser");
  await note.getByRole("button", { name: "Open the camera app" }).click();
  const fc = await chooser;
  expect(await fc.element().getAttribute("capture")).toBe("environment");
});

test("no getUserMedia at all: Record goes straight to the camera-app picker", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
  });
  await page.goto("/start");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const fc = await chooser;
  expect(await fc.element().getAttribute("capture")).toBe("environment");
});

test("WebM recording (browsers without MP4 recording): the take's length still reads, no block", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = MediaRecorder.isTypeSupported.bind(MediaRecorder);
    MediaRecorder.isTypeSupported = (t: string) => !t.startsWith("video/mp4") && orig(t);
  });
  await page.goto("/start");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const cam = page.getByRole("group", { name: "Camera" });
  await expect(cam).toHaveAttribute("data-phase", "ready");
  await cam.getByRole("button", { name: "Start recording" }).click();
  await page.waitForTimeout(6300);
  await cam.getByRole("button", { name: "Stop recording" }).click();
  const card = page.getByRole("group", { name: "Your walkthrough" });
  // MediaRecorder WebM has no duration header (reads as Infinity); the upload screen works it out.
  await expect(card).toContainText(/walkthrough-.*\.webm/);
  await expect(page.getByRole("button", { name: "Make my work plan" })).toBeEnabled();
  await expect(card).toContainText("0:06");
  await expect(card).not.toContainText("couldn't read this video's length");
});

/** Counts screen wake lock requests and releases (Chromium headless may not grant a real one). */
const stubWakeLock = () => {
  const w = window as unknown as { __wake: { requested: number; released: number } };
  w.__wake = { requested: 0, released: 0 };
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: {
      request: async () => {
        w.__wake.requested++;
        const s = {
          released: false,
          release: async () => {
            if (!s.released) w.__wake.released++;
            s.released = true;
          },
        };
        return s;
      },
    },
  });
};

test("Record: the screen is kept on while the camera is open, and the mic level moves with sound", async ({ page }) => {
  await page.addInitScript(stubWakeLock);
  await page.goto("/start");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const cam = page.getByRole("group", { name: "Camera" });
  await expect(cam).toHaveAttribute("data-phase", "ready");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __wake: { requested: number } }).__wake.requested)).toBeGreaterThan(0);

  // The fake mic plays a beep, so the bar rises above its 4% floor.
  const meter = cam.getByTestId("mic-level");
  await expect(meter).toBeVisible();
  await expect(meter.getByText("Microphone level")).toBeAttached();
  await expect
    .poll(async () => meter.locator("span[style]").evaluate((el) => parseFloat((el as HTMLElement).style.width)))
    .toBeGreaterThan(4);

  await cam.getByRole("button", { name: "Start recording" }).click();
  await expect(cam).toHaveAttribute("data-phase", "recording");
  await expect(meter).toBeVisible();
  await expect(cam.getByTestId("mic-missing")).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(cam.getByTestId("mic-quiet")).toHaveCount(0);
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "recorder with mic level");

  await cam.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("group", { name: "Camera" })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __wake: { released: number } }).__wake.released))
    .toBeGreaterThan(0);
});

// Small and sideways phones (plus tablet and laptop sizes): when the camera opens, the card lands under the sticky header with the whole
// preview and Start on screen (no scrolling to find it), focus is on Start, then on Stop once recording.
for (const vp of [
  { width: 320, height: 568 },
  { width: 667, height: 375 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
]) {
  test(`Record on a ${vp.width}x${vp.height} screen: preview and Start fit on screen, focus follows Start then Stop`, async ({ page }, info) => {
    test.skip(info.project.name !== "phone-390", "phone sizes only");
    await page.setViewportSize(vp);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/start");
    await page.getByRole("button", { name: "Record a walkthrough" }).click();
    const cam = page.getByRole("group", { name: "Camera" });
    await expect(cam).toHaveAttribute("data-phase", "ready");
    const start = cam.getByRole("button", { name: "Start recording" });
    await expect(start).toBeFocused();
    // Measured in the page, so Playwright's own scroll-before-click can't hide a bad layout.
    const fit = async (name: string) =>
      page.evaluate((name) => {
        const header = document.querySelector("header")!.getBoundingClientRect();
        const video = document.querySelector('[aria-label="Camera"] video')!.getBoundingClientRect();
        const btn = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Camera"] button')].find((b) => b.textContent?.includes(name))!.getBoundingClientRect();
        return { headerBottom: header.bottom, videoTop: video.top, videoHeight: video.height, btnBottom: btn.bottom, vh: window.innerHeight };
      }, name);
    await expect.poll(async () => (await fit("Start recording")).videoTop).toBeGreaterThanOrEqual((await fit("Start recording")).headerBottom - 1);
    const ready = await fit("Start recording");
    expect(ready.btnBottom, "Start is on screen").toBeLessThanOrEqual(ready.vh);
    expect(ready.videoHeight, "the preview is still big enough to aim with").toBeGreaterThanOrEqual(100);
    await expectNoSideScroll(page);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `recorder-fit-${vp.width}x${vp.height}.png`) });

    await page.keyboard.press("Enter");
    const stop = cam.getByRole("button", { name: "Stop recording" });
    await expect(stop).toBeFocused();
    const rec = await fit("Stop recording");
    expect(rec.videoTop).toBeGreaterThanOrEqual(rec.headerBottom - 1);
    expect(rec.btnBottom, "Stop is on screen").toBeLessThanOrEqual(rec.vh);
    await expectNoAxeViolations(page, `recording at ${vp.width}x${vp.height}`);
    await cam.getByRole("button", { name: "Cancel" }).click();
  });
}

test("Record with the mic blocked or missing: the camera still opens, video only, with the no-mic note", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      if (c?.audio) throw new DOMException("mic blocked", "NotAllowedError");
      return orig(c);
    };
  });
  await page.goto("/start");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const cam = page.getByRole("group", { name: "Camera" });
  await expect(cam).toHaveAttribute("data-phase", "ready");
  await expect(cam.getByTestId("mic-missing")).toBeVisible();
  await expect(cam.getByTestId("mic-level")).toHaveCount(0);
  await expect(page.getByText("Camera or microphone access was blocked")).toHaveCount(0);
});

test("Record while Web Audio stays suspended (phones before a tap): no false 'can't hear you'", async ({ page }) => {
  await page.addInitScript(() => {
    const Orig = window.AudioContext;
    window.AudioContext = class extends Orig {
      constructor(o?: AudioContextOptions) {
        super(o);
        void this.suspend();
      }
      resume() {
        return Promise.resolve();
      }
    } as typeof AudioContext;
  });
  await page.goto("/start");
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  const cam = page.getByRole("group", { name: "Camera" });
  await expect(cam).toHaveAttribute("data-phase", "ready");
  await cam.getByRole("button", { name: "Start recording" }).click();
  await page.waitForTimeout(6500);
  await expect(cam.getByTestId("mic-quiet")).toHaveCount(0);
  await cam.getByRole("button", { name: "Stop recording" }).click();
});
