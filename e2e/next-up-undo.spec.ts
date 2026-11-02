import { test, expect, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

// /api stays blocked (helpers.ts) and console errors fail the test. Step ticks live in localStorage per plan.
test.beforeEach(async ({ apiCalls, pageErrors }) => {
  void apiCalls;
  void pageErrors;
});

test("Mark step done on Next up offers an Undo that takes back just that step", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  await page.getByRole("checkbox", { name: /^Step 2 done:/ }).check();
  const card = page.getByTestId("next-up");
  await expect(card.getByTestId("next-up-undo")).toHaveCount(0);

  await card.getByRole("button", { name: "Mark step 1 done" }).click();
  const undo = card.getByTestId("next-up-undo");
  await expect(undo.getByRole("status")).toHaveText("Marked step 1 done.");
  await expect(card.getByTestId("next-up-progress")).toHaveText("2 of 8 steps done.");

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await card.scrollIntoViewIfNeeded();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `next up undo ${width}`);
  }

  await undo.getByRole("button", { name: "Undo marking step 1 done" }).click();
  await expect(page.getByRole("checkbox", { name: /^Step 1 done:/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Step 2 done:/ })).toBeChecked();
  await expect(card.getByTestId("next-up-progress")).toHaveText("1 of 8 steps done.");
  await expect(card.getByTestId("next-up-step")).toContainText("Make the ceiling safe");
  await expect(card.getByTestId("next-up-undo")).toHaveCount(0);
});

test("the Undo goes away once another step is ticked, and shows on the done card after the last step", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  await page.getByRole("checkbox", { name: /^Step 2 done:/ }).check();
  const card = page.getByTestId("next-up");
  await card.getByRole("button", { name: "Mark step 1 done" }).click();
  await expect(card.getByTestId("next-up-undo")).toHaveCount(1);
  await page.getByRole("checkbox", { name: /^Step 3 done:/ }).check();
  await expect(card.getByTestId("next-up-undo")).toHaveCount(0);

  for (const o of [4, 5, 6, 7]) await page.getByRole("checkbox", { name: new RegExp(`^Step ${o} done:`) }).check();
  await card.getByRole("button", { name: "Mark step 8 done" }).click();
  await expect(card).toHaveAttribute("data-kind", "all");
  await expect(card.getByTestId("next-up-undo").getByRole("status")).toHaveText("Marked step 8 done.");
  await card.getByRole("button", { name: "Undo marking step 8 done" }).click();
  await expect(card).toHaveAttribute("data-kind", "next");
  await expect(card.getByTestId("next-up-step")).toContainText(/./);
  await expect(page.getByRole("checkbox", { name: /^Step 8 done:/ })).not.toBeChecked();
});

test("the Undo line stays off paper", async ({ page }) => {
  await page.goto("/start?view=example&ex=kitchen");
  await page.getByRole("checkbox", { name: /^Step 2 done:/ }).check();
  await page.getByTestId("next-up").getByRole("button", { name: "Mark step 1 done" }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("next-up-undo")).toBeHidden();
});
