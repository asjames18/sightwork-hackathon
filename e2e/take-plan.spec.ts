import fs from "node:fs";
import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * A saved take that already made a plan says so on /start ("Plan made: ...") with an Open plan button,
 * so the same video isn't run twice by accident. The take and the plan are seeded straight into the
 * browser's storage in the same shape the app writes; nothing reaches /api or a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));
const TAKE = "walkthrough-2026-11-02-1240.webm";
const OTHER = "walkthrough-2026-11-02-1250.webm";

async function seed(page: import("@playwright/test").Page, withPlan: boolean) {
  await page.goto("/start");
  await page.evaluate(
    async ({ plan, withPlan, TAKE, OTHER }) => {
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
        const blob = new Blob([new Uint8Array(2048)], { type: "video/webm" });
        tx.objectStore("plans").put({ blob, name: TAKE, type: "video/webm" }, "take:t1");
        tx.objectStore("plans").put({ blob, name: OTHER, type: "video/webm" }, "take:t2");
        if (withPlan) tx.objectStore("plans").put({ plan, videoName: TAKE, savedAt: "2026-11-02T17:43:00.000Z" }, "recent:pT");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      localStorage.setItem(
        "sightwork:savedTakes:v1",
        JSON.stringify([
          { id: "t2", name: OTHER, type: "video/webm", size: 2048, savedAt: "2026-11-02T17:50:00.000Z", durationSec: 64 },
          { id: "t1", name: TAKE, type: "video/webm", size: 2048, savedAt: "2026-11-02T17:40:00.000Z", durationSec: 71 },
        ]),
      );
      if (withPlan)
        localStorage.setItem(
          "sightwork:recentPlans:v1",
          JSON.stringify([{ id: "pT", spaceName: plan.spaceName, region: null, savedAt: "2026-11-02T17:43:00.000Z", problems: plan.issues.length, videoName: TAKE }]),
        );
    },
    { plan: sanctuary, withPlan, TAKE, OTHER },
  );
  await page.reload();
}

for (const width of [375, 768, 1280]) {
  test(`saved take with a plan: says Plan made and opens it (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page, true);
    const list = page.getByTestId("saved-takes");
    const rows = list.getByRole("listitem");
    await expect(rows).toHaveCount(2);
    // Only the take that made a plan says so.
    await expect(rows.nth(0).getByTestId("take-plan")).toHaveCount(0);
    await expect(rows.nth(0).getByRole("button", { name: /^Open plan/ })).toHaveCount(0);
    const made = rows.nth(1).getByTestId("take-plan");
    await expect(made).toHaveText(`Plan made: ${sanctuary.spaceName} · ${sanctuary.issues.length} problems`);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `saved take with its plan (${width} px)`);
    await page.emulateMedia({ media: "print" });
    await expect(list).toBeHidden();
    await page.emulateMedia({ media: "screen" });

    await rows.nth(1).getByRole("button", { name: `Open plan made from ${TAKE}` }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(sanctuary.spaceName);
    await expect(page.getByTestId("saved-takes")).toHaveCount(0);
    await expectNoSideScroll(page);
  });
}

test("saved take without a plan: no Plan made line or Open plan button", async ({ page }) => {
  await seed(page, false);
  const list = page.getByTestId("saved-takes");
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByTestId("take-plan")).toHaveCount(0);
  await expect(list.getByRole("button", { name: /^Open plan/ })).toHaveCount(0);
});

test("saved take whose plan was deleted: says so and drops the line", async ({ page }) => {
  await seed(page, true);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("sightwork", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("plans", "readwrite");
      tx.objectStore("plans").delete("recent:pT");
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  const list = page.getByTestId("saved-takes");
  await list.getByRole("button", { name: `Open plan made from ${TAKE}` }).click();
  await expect(list.getByText("That plan is no longer saved on this device, so it was taken off the list.")).toBeVisible();
  await expect(list.getByTestId("take-plan")).toHaveCount(0);
});
