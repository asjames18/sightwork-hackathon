import fs from "node:fs";
import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/**
 * A work step whose only detail is a caution chip (needs time to dry, needs dry weather) still shows it, and a
 * step with nothing to show draws no empty details row. Plans are seeded into the browser's storage in the
 * app's own shape; nothing reaches /api or a model.
 */
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

const sanctuary = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/lib/examples/sanctuary-run.json"), "utf8"));
const region = "Atlanta, GA";
const bareSteps = [
  { order: 1, title: "Prime and paint the stage trim", detail: "Prime and paint the trim, then keep everyone off it until it has cured." },
  { order: 2, title: "Fix the back fence", detail: "Reset the leaning posts and replace the broken fence boards along the back yard." },
  { order: 3, title: "Walk the room", detail: "Walk the room once with the team and tick off what is done." },
];
const plan = { ...sanctuary, materials: [], workOrder: bareSteps, meta: { ...sanctuary.meta, region } };

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
async function seed(page: import("@playwright/test").Page) {
  const savedAt = new Date(Date.now() - 3600_000).toISOString();
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
  await page.getByRole("region", { name: "Your recent plans" }).getByRole("button", { name: String(plan.spaceName) }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

for (const width of [375, 768, 1280]) {
  test(`a step with only a caution to show still shows it, and a bare step has no empty row at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    const steps = page.locator("#work-steps-list");
    await steps.scrollIntoViewIfNeeded();
    const paint = steps.locator(":scope > li", { hasText: "Prime and paint the stage trim" });
    await expect(paint.getByTestId("step-dry")).toContainText("Needs time to dry");
    const fence = steps.locator(":scope > li", { hasText: "Fix the back fence" });
    await expect(fence.getByTestId("step-weather")).toContainText("Needs dry weather");
    const bare = steps.locator(":scope > li", { hasText: "Walk the room" });
    await expect(bare).toBeVisible();
    await expect(bare.getByRole("list", { name: "Step details" })).toBeHidden();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `bare step cautions ${width}`);
  });
}
