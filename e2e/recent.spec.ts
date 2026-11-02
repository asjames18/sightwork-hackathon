import fs from "node:fs";
import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * "Your recent plans" on /start: the last few real runs kept on this device. Plans are seeded straight
 * into the browser's storage in the same shape the app writes; nothing reaches /api or a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));

async function seed(page: import("@playwright/test").Page, plans: { id: string; plan: unknown; savedAt: string; region: string | null }[]) {
  await page.goto("/start");
  await page.evaluate(async (rows) => {
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
    const index = rows.map((r) => ({
      id: r.id,
      spaceName: (r.plan as { spaceName: string }).spaceName,
      region: r.region,
      savedAt: r.savedAt,
      problems: (r.plan as { issues: unknown[] }).issues.length,
      videoName: `${r.id}.mov`,
    }));
    localStorage.setItem("sightwork:recentPlans:v1", JSON.stringify(index));
  }, plans);
  await page.reload();
}

const office = { ...sanctuary, spaceName: "Front office" };

test("recent plans list: shows each run, reopens one, and removes one", async ({ page }) => {
  await seed(page, [
    { id: "pA", plan: office, savedAt: "2026-10-30T22:10:00Z", region: "Tampa, FL" },
    { id: "pB", plan: sanctuary, savedAt: "2026-10-30T21:00:00Z", region: "Sebring, FL" },
  ]);
  const section = page.getByRole("region", { name: "Your recent plans" });
  await expect(section).toBeVisible();
  const rows = section.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Front office");
  await expect(rows.nth(0)).toContainText("Tampa, FL");
  await expect(rows.nth(0)).toContainText(`${sanctuary.issues.length} problems`);
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "recent plans list");

  await rows.nth(1).getByRole("button", { name: "Remove" }).click();
  // Undo is on offer (and focused), so the list stays up with the one row left.
  await expect(section.getByRole("status")).toContainText("Removed Sanctuary");
  const undo = section.getByRole("button", { name: /^Undo/ });
  await expect(undo).toBeFocused();
  await expect(rows).toHaveCount(1);
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "recent plans undo note");

  await undo.click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("Sanctuary");
  await expect(rows.nth(1).getByRole("button", { name: /^Sanctuary/ })).toBeFocused();
  await expect(section.getByRole("status")).toHaveCount(0);

  // The restored row still opens its plan.
  await rows.nth(1).getByRole("button", { name: /^Sanctuary/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sanctuary");

  await page.goto("/start");
  await section.getByRole("listitem").nth(1).getByRole("button", { name: "Remove" }).click();
  await expect(section.getByRole("status")).toContainText("Removed Sanctuary");
  const index = await page.evaluate(() => JSON.parse(localStorage.getItem("sightwork:recentPlans:v1") ?? "[]").length);
  expect(index).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(section).toHaveCount(0); // one left: the list hides, "Open my last plan" covers a single plan
});

test("recent plans list: tapping a row opens that plan", async ({ page }) => {
  await seed(page, [
    { id: "pA", plan: office, savedAt: "2026-10-30T22:10:00Z", region: "Tampa, FL" },
    { id: "pB", plan: sanctuary, savedAt: "2026-10-30T21:00:00Z", region: null },
  ]);
  await page.getByRole("region", { name: "Your recent plans" }).getByRole("button", { name: /^Front office/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Front office");
  await expectNoSideScroll(page);
});

test("recent plans list: a row whose saved copy is gone is taken off with a note", async ({ page }) => {
  await seed(page, [
    { id: "pA", plan: office, savedAt: "2026-10-30T22:10:00Z", region: null },
    { id: "pB", plan: sanctuary, savedAt: "2026-10-30T21:00:00Z", region: null },
    { id: "pC", plan: { ...sanctuary, spaceName: "Storage room" }, savedAt: "2026-10-30T20:00:00Z", region: null },
  ]);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open("sightwork", 1);
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("plans", "readwrite");
      tx.objectStore("plans").delete("recent:pC");
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  const section = page.getByRole("region", { name: "Your recent plans" });
  await section.getByRole("button", { name: /^Storage room/ }).click();
  await expect(section.getByRole("status")).toContainText("no longer saved on this device");
  await expect(section.getByRole("listitem")).toHaveCount(2);
});

test("no recent list on a fresh device", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your recent plans" })).toHaveCount(0);
});

for (const width of [375, 768, 1280]) {
  test(`recent plans undo note fits at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await seed(page, [
      { id: "pA", plan: { ...sanctuary, spaceName: "Fellowship hall and the long back hallway by the kitchen" }, savedAt: "2026-10-30T22:10:00Z", region: null },
      { id: "pB", plan: office, savedAt: "2026-10-30T21:00:00Z", region: null },
      { id: "pC", plan: sanctuary, savedAt: "2026-10-30T20:00:00Z", region: null },
    ]);
    const section = page.getByRole("region", { name: "Your recent plans" });
    await section.getByRole("listitem").nth(0).getByRole("button", { name: "Remove" }).click();
    await expect(section.getByRole("button", { name: /^Undo/ })).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `recent plans undo note at ${width}`);
  });
}
