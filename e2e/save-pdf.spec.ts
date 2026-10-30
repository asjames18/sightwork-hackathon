import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";
import type { Page } from "@playwright/test";

// /api stays blocked and console errors fail the test (helpers.ts). Save PDF never needs the server.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const SAMPLE = "/start?view=example&ex=kitchen";
const REAL_RUN = "/start?view=example&ex=sanctuary";

type Shared = { name: string; type: string; size: number; head: string; title: string; text?: string; pages: number; files: number };
type Win = Window & { __shared: Shared[]; __prints: number; __refuseOnce?: boolean };

/** A phone share sheet that takes PDFs: records what it was handed (file name, type, first bytes, page count). */
async function stubShareSheet(page: Page, opts: { refuseFirst?: boolean } = {}) {
  await page.addInitScript((refuseFirst) => {
    const w = window as unknown as Win;
    w.__shared = [];
    w.__prints = 0;
    w.__refuseOnce = refuseFirst;
    window.print = () => {
      w.__prints += 1;
    };
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (d: { files?: File[] }) => !d.files || d.files.every((f) => f.type === "application/pdf"),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: { title?: string; text?: string; files?: File[] }) => {
        if (w.__refuseOnce) {
          w.__refuseOnce = false;
          throw new DOMException("Must be handling a user gesture", "NotAllowedError");
        }
        const f = d.files?.[0];
        if (!f) {
          w.__shared.push({ name: "", type: "", size: 0, head: "", title: d.title ?? "", text: d.text, pages: 0, files: 0 });
          return;
        }
        const bytes = new Uint8Array(await f.arrayBuffer());
        const latin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
        w.__shared.push({
          name: f.name,
          type: f.type,
          size: f.size,
          head: latin.slice(0, 5),
          title: (latin.match(/\/Title \(([^)]*)\)/) ?? [])[1] ?? "",
          text: d.text,
          pages: (latin.match(/\/Type \/Page\b(?!s)/g) ?? []).length,
          files: d.files?.length ?? 0,
        });
      },
    });
  }, opts.refuseFirst ?? false);
}

const shared = (page: Page) => page.evaluate(() => (window as unknown as Win).__shared);
const NAME = /^sightwork-plan-\d{4}-\d{2}-\d{2}\.pdf$/;

test.describe("Save PDF on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone share sheet");

  test("shares a real PDF file (Save to Files), with a loading state, and never opens print", async ({ page }) => {
    await stubShareSheet(page);
    await page.goto(SAMPLE);
    const save = page.getByRole("button", { name: "Save PDF" });
    await expect(save).toBeVisible();
    await expectNoSideScroll(page);
    await save.click();
    await expect.poll(async () => (await shared(page)).length, { timeout: 20_000 }).toBe(1);
    const [s] = await shared(page);
    expect(s.files).toBe(1);
    expect(s.name).toMatch(NAME);
    expect(s.type).toBe("application/pdf");
    expect(s.head).toBe("%PDF-");
    expect(s.size).toBeGreaterThan(20_000);
    expect(s.pages).toBeGreaterThanOrEqual(2);
    expect(s.title).toContain("Work plan: ");
    expect(await page.evaluate(() => (window as unknown as Win).__prints)).toBe(0);
    await expect(save).toHaveAttribute("data-state", "idle");
    await expectNoAxeViolations(page, "plan after Save PDF on a phone");
  });

  test("when the tap went stale, asks for one more tap and then shares", async ({ page }) => {
    await stubShareSheet(page, { refuseFirst: true });
    await page.goto(REAL_RUN);
    const save = page.getByRole("button", { name: "Save PDF" });
    await save.click();
    await expect(page.getByTestId("save-pdf-status")).toHaveText(/Your PDF is ready\. Tap Save PDF again/, { timeout: 20_000 });
    await expect(save).toHaveAttribute("data-state", "tap");
    await save.click();
    await expect.poll(async () => (await shared(page)).length).toBe(1);
    const [s] = await shared(page);
    expect(s.head).toBe("%PDF-");
    expect(s.title).toContain("Sanctuary stage");
    await expect(page.getByTestId("save-pdf-status")).toHaveText("");
  });

  test("Send to your team attaches the PDF once it is built, with plain-word text", async ({ page }) => {
    await stubShareSheet(page);
    await page.goto(REAL_RUN);
    // The PDF is warmed in the background on phones; Save PDF also builds it.
    await page.getByRole("button", { name: "Save PDF" }).click();
    await expect.poll(async () => (await shared(page)).length, { timeout: 20_000 }).toBe(1);
    await page.getByRole("button", { name: "Send to your team" }).click();
    await expect.poll(async () => (await shared(page)).length).toBe(2);
    const s = (await shared(page))[1];
    expect(s.files).toBe(1);
    expect(s.head).toBe("%PDF-");
    expect(s.text).toMatch(/^Work plan: /);
    expect(s.text).toMatch(/problems?/);
    expect(s.text).not.toMatch(/\[|\]/);
    expect(s.text).toMatch(/Full plan with proof photos in the attached PDF\.$/);
    expect((s.text ?? "").length).toBeLessThanOrEqual(1600);
  });
});

test.describe("Save PDF on a computer", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "desktop download");

  test("downloads sightwork-plan-<date>.pdf with the plan in it", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Win).__prints = 0;
      window.print = () => {
        (window as unknown as Win).__prints += 1;
      };
    });
    await page.goto(REAL_RUN);
    const save = page.getByRole("button", { name: "Save PDF" });
    const download = page.waitForEvent("download", { timeout: 20_000 });
    await save.click();
    const d = await download;
    expect(d.suggestedFilename()).toMatch(NAME);
    const path = await d.path();
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(path);
    const latin = bytes.toString("latin1");
    expect(latin.slice(0, 5)).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(20_000);
    expect((latin.match(/\/Type \/Page\b(?!s)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(latin).toMatch(/\/Title \(Work plan: Sanctuary stage/);
    // Before and after pictures plus proof photos are in it.
    expect((latin.match(/\/Subtype \/Image/g) ?? []).length).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId("save-pdf-status")).toHaveText(/Saved sightwork-plan-.*\.pdf/);
    expect(await page.evaluate(() => (window as unknown as Win).__prints)).toBe(0);
    if (process.env.SAVE_PDF_SAMPLE_OUT) await d.saveAs(process.env.SAVE_PDF_SAMPLE_OUT);
  });

  test("a sample plan's PDF downloads too", async ({ page }) => {
    await page.goto(SAMPLE);
    const download = page.waitForEvent("download", { timeout: 20_000 });
    await page.getByRole("button", { name: "Save PDF" }).click();
    const d = await download;
    const { readFileSync } = await import("node:fs");
    const latin = readFileSync(await d.path()).toString("latin1");
    expect(latin.slice(0, 5)).toBe("%PDF-");
    expect(latin).toMatch(/\/Title \(Work plan: /);
  });
});
