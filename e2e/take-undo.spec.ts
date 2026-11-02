import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * Removing a saved take on /start offers Undo, which puts the take and its stored video back in the
 * same place. Takes are seeded straight into the browser's storage in the shape the app writes; nothing
 * reaches /api or a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const NEW = "walkthrough-2026-11-02-1250.webm";
const OLD = "walkthrough-2026-11-02-1240.webm";

async function seed(page: import("@playwright/test").Page, both = true) {
  await page.goto("/start");
  await page.evaluate(
    async ({ NEW, OLD, both }) => {
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
        tx.objectStore("plans").put({ blob, name: NEW, type: "video/webm" }, "take:t2");
        if (both) tx.objectStore("plans").put({ blob, name: OLD, type: "video/webm" }, "take:t1");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      const rows = [{ id: "t2", name: NEW, type: "video/webm", size: 2048, savedAt: "2026-11-02T17:50:00.000Z", durationSec: 64 }];
      if (both) rows.push({ id: "t1", name: OLD, type: "video/webm", size: 2048, savedAt: "2026-11-02T17:40:00.000Z", durationSec: 71 });
      localStorage.setItem("sightwork:savedTakes:v1", JSON.stringify(rows));
    },
    { NEW, OLD, both },
  );
  await page.reload();
}

const storedKeys = (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("sightwork", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const keys = await new Promise<string[]>((resolve) => {
      const req = db.transaction("plans").objectStore("plans").getAllKeys();
      req.onsuccess = () => resolve((req.result as string[]).filter((k) => k.startsWith("take:")).sort());
    });
    db.close();
    return keys;
  });

for (const width of [375, 768, 1280]) {
  test(`remove a saved take, then Undo puts it back (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    const list = page.getByTestId("saved-takes");
    const rows = list.getByRole("listitem");
    await expect(rows).toHaveCount(2);

    await rows.nth(0).getByRole("button", { name: new RegExp(`^Remove ${NEW.replace(/\./g, "\\.")}`) }).click();
    await expect(rows).toHaveCount(1);
    const undo = list.getByRole("button", { name: `Undo: put ${NEW} back on this device` });
    await expect(undo).toBeFocused();
    await expect(list.getByTestId("take-undo").getByRole("status")).toContainText(`Removed ${NEW}`);
    await expect.poll(() => storedKeys(page)).toEqual(["take:t1"]);
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `saved take undo (${width} px)`);

    await undo.click();
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(NEW);
    await expect(rows.nth(0).getByRole("button", { name: `Watch ${NEW} on this device` })).toBeFocused();
    await expect(list.getByTestId("take-undo")).toHaveCount(0);
    await expect.poll(() => storedKeys(page)).toEqual(["take:t1", "take:t2"]);
    await page.reload();
    await expect(page.getByTestId("saved-takes").getByRole("listitem")).toHaveCount(2);
  });
}

test("removing the only saved take keeps Undo on offer, and Undo brings the list back", async ({ page }) => {
  await seed(page, false);
  const list = page.getByTestId("saved-takes");
  await list.getByRole("button", { name: new RegExp(`^Remove ${NEW.replace(/\./g, "\\.")}`) }).click();
  await expect(list.getByRole("listitem")).toHaveCount(0);
  await expect(list.getByRole("button", { name: `Undo: put ${NEW} back on this device` })).toBeVisible();
  await expectNoSideScroll(page);
  await page.emulateMedia({ media: "print" });
  await expect(list).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await list.getByRole("button", { name: /^Undo/ }).click();
  await expect(page.getByTestId("saved-takes").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Your saved takes" })).toBeVisible();
});

test("Undo goes away once another take is used", async ({ page }) => {
  await seed(page);
  const list = page.getByTestId("saved-takes");
  await list.getByRole("button", { name: new RegExp(`^Remove ${NEW.replace(/\./g, "\\.")}`) }).click();
  await expect(list.getByRole("button", { name: /^Undo/ })).toBeVisible();
  await list.getByRole("button", { name: `Use ${OLD} for a new plan` }).click();
  await expect(page.getByRole("button", { name: /^Undo: put/ })).toHaveCount(0);
});
