import fs from "node:fs";
import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * "Since your last walkthrough": a real plan reopened from "Your recent plans" is compared with the
 * earlier saved run of the same space and place. Plans are seeded into the browser's storage in the
 * app's own shape; nothing reaches /api or a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));
const region = "Atlanta, GA";
const before = { ...sanctuary, meta: { ...sanctuary.meta, region } };
const after = {
  ...before,
  issues: [
    ...sanctuary.issues.filter((i: { hazard?: string }) => i.hazard !== "exposed_wiring"),
    { ...sanctuary.issues[0], rank: 5, title: "Water stain spreading on ceiling above choir", hazard: "water_stain", severity: "medium" },
  ],
};

/** Same id the app gives a saved plan (recentPlanId), so the current run is recognised as itself. */
function planId(p: { spaceName?: string; generatedFrom?: string; issues: { title: string }[]; meta?: { region?: string; costUsd?: number } }): string {
  const titles = p.issues.map((i) => i.title).join("~");
  const cost = typeof p.meta?.costUsd === "number" ? String(p.meta.costUsd) : "";
  const basis = `${p.spaceName ?? ""}|${p.generatedFrom ?? ""}|${p.issues.length}|${titles}|${p.meta?.region ?? ""}|${cost}`;
  let h = 5381;
  for (let i = 0; i < basis.length; i++) h = ((h << 5) + h + basis.charCodeAt(i)) >>> 0;
  return `p${h.toString(36)}`;
}

async function seed(page: import("@playwright/test").Page) {
  const rows = [
    { id: planId(after), plan: after, savedAt: "2026-10-31T14:00:00Z" },
    { id: planId(before), plan: before, savedAt: "2026-10-30T18:00:00Z" },
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
      const index = rows.map((r) => ({
        id: r.id,
        spaceName: (r.plan as { spaceName: string }).spaceName,
        region,
        savedAt: r.savedAt,
        problems: (r.plan as { issues: unknown[] }).issues.length,
        videoName: `${r.id}.mov`,
      }));
      localStorage.setItem("sightwork:recentPlans:v1", JSON.stringify(index));
    },
    { rows, region },
  );
  await page.reload();
}

for (const width of [375, 768, 1280]) {
  test(`since last walkthrough card at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    const list = page.getByRole("region", { name: "Your recent plans" });
    await list.getByRole("button", { name: /^Sanctuary stage/ }).first().click();
    const card = page.getByRole("region", { name: "Since your last walkthrough" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("1 no longer seen, 3 still there, 1 new");
    await expect(card.getByTestId("since-last-gone")).toContainText("Exposed wiring");
    await expect(card.getByTestId("since-last-new")).toContainText("Water stain spreading");
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `since last walkthrough ${width}`);
    await card.screenshot({ path: `/workspace/sw/run0900b/since-last-${width}.png` });
  });
}

test("the earliest run has nothing to compare with", async ({ page }) => {
  await seed(page);
  await page.getByRole("region", { name: "Your recent plans" }).getByRole("button", { name: /^Sanctuary stage/ }).nth(1).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole("region", { name: "Since your last walkthrough" })).toHaveCount(0);
});

test("example plans never show the card", async ({ page }) => {
  await seed(page);
  await page.goto("/start?view=example");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole("region", { name: "Since your last walkthrough" })).toHaveCount(0);
});

test("Send to your team carries the same comparison in the text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await page.getByRole("region", { name: "Your recent plans" }).getByRole("button", { name: /^Sanctuary stage/ }).first().click();
  await expect(page.getByRole("region", { name: "Since your last walkthrough" })).toBeVisible();
  await page.getByRole("button", { name: "Send to your team" }).click();
  await expect(page.getByText("Plan copied. Paste it into a text or email.")).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/Since the last walkthrough \([^)]+\): 1 no longer seen, 3 still there, 1 new\./);
  expect(text).toContain("- No longer seen: Exposed wiring");
  expect(text).toContain("- New this time: Water stain spreading on ceiling above choir (fix soon)");
  expect(text).toContain("check the photos before counting one as fixed.");
});

test("example plans keep the comparison out of the shared text", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await page.goto("/start?view=example");
  await page.getByRole("button", { name: "Send to your team" }).click();
  await expect(page.getByText("Plan copied. Paste it into a text or email.")).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).not.toContain("Since the last walkthrough");
});

test("Save PDF carries the same comparison as the card", async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), "desktop download");
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await page.getByRole("region", { name: "Your recent plans" }).getByRole("button", { name: /^Sanctuary stage/ }).first().click();
  await expect(page.getByRole("region", { name: "Since your last walkthrough" })).toBeVisible();
  const download = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: "Save PDF" }).click();
  const file = await (await download).path();
  const { execFileSync } = await import("node:child_process");
  const text = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }).replace(/\s+/g, " ");
  expect(text).toContain("Since your last walkthrough");
  expect(text).toMatch(/1 no longer seen, 3 still there, 1 new, compared with the walkthrough of this space on /);
  expect(text).toContain("No longer seen (1)");
  expect(text).toContain("Water stain spreading on ceiling above choir (fix soon)");
  expect(text).toContain("check the photos before you count one as fixed");
});
