import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

// A fake speech voice: records what was spoken and finishes each piece only when the test says so.
const FAKE_SPEECH = () => {
  const w = window as unknown as Record<string, unknown>;
  const spoken: string[] = [];
  const queue: Array<{ text: string; onstart?: () => void; onend?: () => void; onerror?: (e: { error: string }) => void }> = [];
  w.__spoken = spoken;
  const rates: Array<number | undefined> = [];
  w.__rates = rates;
  w.__finish = () => {
    const u = queue.shift();
    if (u) u.onend?.();
    queue[0]?.onstart?.();
  };
  const define = (name: string, value: unknown) => Object.defineProperty(window, name, { value, configurable: true, writable: true });
  define("SpeechSynthesisUtterance", function (this: { text: string }, text: string) {
    this.text = text;
  });
  define("speechSynthesis", {
    speak: (u: { text: string; rate?: number; onstart?: () => void; onend?: () => void }) => {
      spoken.push(u.text);
      rates.push(u.rate);
      queue.push(u);
      if (queue.length === 1) u.onstart?.();
    },
    cancel: () => {
      const q = queue.splice(0);
      for (const u of q) u.onerror?.({ error: "canceled" });
    },
  });
};

test("Read it to me: speaks the plan, Stop reading stops it, and it ends on its own", async ({ page }) => {
  await page.addInitScript(FAKE_SPEECH);
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  const btn = page.getByTestId("read-aloud");
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(btn).toHaveText("Read it to me");
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await btn.click();
    await expect(btn).toHaveText("Stop reading");
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("status").filter({ hasText: "Reading the plan aloud" })).toBeVisible();
    const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
    expect(spoken[0]).toMatch(/^Work plan for /);
    expect(spoken.some((s) => /^Problem 1, /.test(s))).toBe(true);
    expect(spoken.some((s) => /^Step 1\. /.test(s))).toBe(true);
    // The last piece is the cost when the plan has one, else the last step.
    expect(spoken.at(-1)).toMatch(/^(Rough cost: |Step \d+\. )/);
    expect(spoken.some((s) => s.startsWith("Said at"))).toBe(false);
    // The progress line starts at part 1 and moves on when the voice finishes a piece.
    const progress = page.getByTestId("read-aloud-progress");
    await expect(progress).toHaveText(/^Part 1 of \d+$/);
    await page.evaluate(() => (window as unknown as { __finish: () => void }).__finish());
    await expect(progress).toHaveText(/^Part 2 of \d+$/);
    for (const s of spoken) expect(s.length).toBeLessThanOrEqual(220);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `read aloud ${width}`);
    // Stop.
    await btn.click();
    await expect(btn).toHaveText("Read it to me");
    await expect(page.getByRole("status").filter({ hasText: "Stopped reading." })).toBeVisible();
    // Start again and let it run to the end: the button goes back by itself.
    await btn.click();
    await expect(btn).toHaveText("Stop reading");
    const total = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length);
    expect(total).toBeGreaterThan(spoken.length);
    await page.evaluate(() => {
      const w = window as unknown as { __finish: () => void };
      for (let i = 0; i < 200; i++) w.__finish();
    });
    await expect(btn).toHaveText("Read it to me");
  }
});

test("Read it to me is left out when the browser has no speech voice", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.speechSynthesis;
    Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
  });
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send to your team" })).toBeVisible();
  await expect(page.getByTestId("read-aloud")).toHaveCount(0);
});

test("Read it to me keeps the screen awake while reading and lets go when it stops", async ({ page }) => {
  await page.addInitScript(FAKE_SPEECH);
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const log = { requests: 0, releases: 0 };
    w.__wake = log;
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          log.requests++;
          const sentinel = {
            released: false,
            release: async () => {
              sentinel.released = true;
              log.releases++;
            },
          };
          return sentinel;
        },
      },
    });
  });
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  const wake = () => page.evaluate(() => (window as unknown as { __wake: { requests: number; releases: number } }).__wake);
  const btn = page.getByTestId("read-aloud");
  expect(await wake()).toEqual({ requests: 0, releases: 0 });
  await btn.click();
  await expect(btn).toHaveText("Stop reading");
  await expect.poll(async () => (await wake()).requests).toBe(1);
  await btn.click();
  await expect(btn).toHaveText("Read it to me");
  await expect.poll(async () => (await wake()).releases).toBe(1);
  // Reading to the end lets go too.
  await btn.click();
  await expect.poll(async () => (await wake()).requests).toBe(2);
  await page.evaluate(() => {
    const w = window as unknown as { __finish: () => void };
    for (let i = 0; i < 200; i++) w.__finish();
  });
  await expect(btn).toHaveText("Read it to me");
  await expect.poll(async () => (await wake()).releases).toBe(2);
});

test("Read it to me speed: Slower, Normal and Faster change the voice rate, are kept on the device, and fit every width", async ({ page }) => {
  await page.addInitScript(FAKE_SPEECH);
  await page.goto("/start?view=example&ex=sanctuary");
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  const btn = page.getByTestId("read-aloud");
  const speed = page.getByTestId("read-speed");
  const rates = () => page.evaluate(() => (window as unknown as { __rates: Array<number | undefined> }).__rates);
  await expect(speed).toHaveText("Speed: Normal");
  await btn.click();
  expect(new Set(await rates())).toEqual(new Set([1]));
  // Pressing while reading keeps the current reading's pace and says so.
  await speed.click();
  await expect(speed).toHaveText("Speed: Faster");
  await expect(page.getByRole("status").filter({ hasText: "starts with the next reading" })).toHaveCount(1);
  expect(new Set(await rates())).toEqual(new Set([1]));
  await btn.click();
  await expect(btn).toHaveText("Read it to me");
  // The next reading uses the new pace.
  const before = (await rates()).length;
  await btn.click();
  const after = await rates();
  expect(after.length).toBeGreaterThan(before);
  expect(new Set(after.slice(before))).toEqual(new Set([1.25]));
  await btn.click();
  // Faster, then Slower.
  await speed.click();
  await expect(speed).toHaveText("Speed: Slower");
  // Kept on this device.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Problems, worst first" })).toBeVisible();
  await expect(speed).toHaveText("Speed: Slower");
  await btn.click();
  expect(new Set(await rates())).toEqual(new Set([0.8]));
  await btn.click();
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(speed).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `read speed ${width}`);
  }
  // Back to normal clears the saved choice.
  await speed.click();
  await expect(speed).toHaveText("Speed: Normal");
  await page.reload();
  await expect(speed).toHaveText("Speed: Normal");
});
