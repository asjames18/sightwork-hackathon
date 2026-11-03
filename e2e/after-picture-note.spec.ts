import fs from "node:fs";
import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * A reopened real plan that finished without its after picture carries a quiet note with a Film it again
 * button; example plans never do. Plans are seeded into the browser's storage in the app's own shape;
 * nothing reaches /api or a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));
const region = "Atlanta, GA";
const plan = { ...sanctuary, afterImageUrl: null, meta: { ...sanctuary.meta, region, skipped: { afterImage: true } } };

/** Same id the app gives a saved plan (recentPlanId). */
function planId(p: { spaceName?: string; generatedFrom?: string; issues: { title: string }[]; meta?: { region?: string; costUsd?: number } }): string {
  const titles = p.issues.map((i) => i.title).join("~");
  const cost = typeof p.meta?.costUsd === "number" ? String(p.meta.costUsd) : "";
  const basis = `${p.spaceName ?? ""}|${p.generatedFrom ?? ""}|${p.issues.length}|${titles}|${p.meta?.region ?? ""}|${cost}`;
  let h = 5381;
  for (let i = 0; i < basis.length; i++) h = ((h << 5) + h + basis.charCodeAt(i)) >>> 0;
  return `p${h.toString(36)}`;
}

/** Two saved plans, because "Your recent plans" lists from two on; the first one is the plan under test. */
async function seed(page: import("@playwright/test").Page, daysAgo: number) {
  const savedAt = new Date(Date.now() - daysAgo * 24 * 3600_000).toISOString();
  const other = { ...plan, issues: plan.issues.slice(1) };
  const otherSavedAt = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
  const rows = [
    { id: planId(plan), plan, savedAt },
    { id: planId(other), plan: other, savedAt: otherSavedAt },
  ];
  await page.goto("/start");
  await page.evaluate(
    async ({ rows, region }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("sightwork", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("plans")) req.result.createObjectStore("plans");
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("plans", "readwrite");
        for (const r of rows) tx.objectStore("plans").put({ plan: r.plan, videoName: `${r.id}.mov`, savedAt: r.savedAt }, `recent:${r.id}`);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      localStorage.setItem(
        "sightwork:recentPlans:v1",
        JSON.stringify(
          rows.map((r) => ({
            id: r.id,
            spaceName: (r.plan as { spaceName: string }).spaceName,
            region,
            savedAt: r.savedAt,
            problems: (r.plan as { issues: unknown[] }).issues.length,
            videoName: `${r.id}.mov`,
          })),
        ),
      );
    },
    { rows, region },
  );
  await page.reload();
  await page.getByRole("region", { name: "Your recent plans" }).getByRole("button", { name: /^Sanctuary stage/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}


for (const width of [375, 768, 1280]) {
  test(`a plan without its after picture says so at ${width} px, and Film it again goes back to the start`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page, 1);
    const note = page.getByTestId("after-picture-note");
    await expect(note).toBeVisible();
    await expect(note).toContainText("came back without an after picture");
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `no after picture note ${width}`);
    await note.getByRole("button", { name: "Film it again" }).click();
    await expect(page.getByTestId("choose-video-input")).toBeAttached();
    await expect(page.getByTestId("after-picture-note")).toHaveCount(0);
    await expect(page).toHaveURL(/\/start/);
  });
}

test("example plans never show the note", async ({ page }) => {
  await seed(page, 1);
  await page.goto("/start?view=example");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("after-picture-note")).toHaveCount(0);
});
