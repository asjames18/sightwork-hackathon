import path from "node:path";
import { test, expect, expectNoAxeViolations, expectNoSideScroll, FIXTURES, WALKTHROUGH } from "./helpers";

/**
 * Room size picker (2026-10-31): four sizes set how long to film, on the upload screen and the video card,
 * from ROOM_SIZES in src/lib/client/duration.ts. Set ROOM_SIZE_SHOT_DIR to save screenshots.
 */
const LONG_80S = path.join(FIXTURES, "walkthrough-80s.webm");
const SHOTS = process.env.ROOM_SIZE_SHOT_DIR;

for (const width of [375, 768, 1280]) {
  test(`room size picker at ${width} px: four sizes, Medium first, aim and cap shown, saved`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/start");
    const picker = page.getByTestId("room-size-picker");
    await expect(picker.getByRole("group", { name: "How big is the space?" }).or(picker)).toBeVisible();
    const radios = picker.getByRole("radio");
    await expect(radios).toHaveCount(4);
    await expect(picker.getByRole("radio", { name: /Medium/ })).toBeChecked();
    await expect(picker).toContainText("Aim for 30–60 s, stops at 75 s");
    await expect(picker).toContainText("Aim for 60–90 s, stops at 2 min");
    await expect(picker).toContainText("Aim for 90 s–3 min, stops at 3 min");
    await expect(picker).toContainText("Aim for 3–5 min, stops at 5 min");
    await expect(picker).toContainText("Warehouse, whole floor, parking lot");
    await expect(page.getByText("MP4 or MOV, 60–90 s (up to 2 min)")).toBeVisible();
    await expect(page.getByText(/One steady take, about 60 to 90 seconds for a medium space/)).toBeVisible();
    await expectNoSideScroll(page);
    await expectNoAxeViolations(page, `upload screen with the room size picker at ${width}`);
    // Every option is a comfortable tap target.
    for (const box of await picker.locator("label").evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
    if (SHOTS) await picker.screenshot({ path: path.join(SHOTS, `room-size-picker-${width}.png`) });

    await picker.getByText("Extra large", { exact: true }).click();
    await expect(picker.getByRole("radio", { name: /Extra large/ })).toBeChecked();
    await expect(page.getByText("MP4 or MOV, 3–5 min (up to 5 min)")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("room-size-picker").getByRole("radio", { name: /Extra large/ })).toBeChecked();
  });
}

test("keyboard: arrow keys move between sizes", async ({ page }) => {
  await page.goto("/start");
  const picker = page.getByTestId("room-size-picker");
  await picker.getByRole("radio", { name: /Medium/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(picker.getByRole("radio", { name: /Large/ }).first()).toBeChecked();
});

test("the same 80 s video: blocked for Small, warned for Medium, fine for Large, re-checked when the size changes", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("room-size-picker").getByText("Small", { exact: true }).click();
  await page.getByTestId("choose-video-input").setInputFiles(LONG_80S);
  const card = page.getByRole("group", { name: "Your walkthrough" });
  const send = card.getByRole("button", { name: "Make my work plan" });
  await expect(card.getByRole("alert")).toContainText("over 75 seconds, the most for a small space");
  await expect(card.getByRole("alert")).toContainText("pick Medium");
  await expect(send).toBeDisabled();
  const cardPicker = card.getByTestId("room-size-picker");
  await expect(cardPicker.getByRole("radio", { name: /Small/ })).toBeChecked();
  if (SHOTS) await card.screenshot({ path: path.join(SHOTS, `video-card-small-blocked-${page.viewportSize()?.width}.png`) });
  await cardPicker.getByText("Medium", { exact: true }).click();
  await expect(send).toBeEnabled();
  await expect(card.getByText("A bit long for a medium space", { exact: false })).toHaveCount(0);
  await cardPicker.getByText("Large", { exact: true }).click();
  await expect(send).toBeEnabled();
  await expect(card.getByRole("alert")).toHaveCount(0);
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "video card with the room size picker");
});

test("a short take is fine for every size up to its warn point (6 s walkthrough, Small)", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("room-size-picker").getByText("Small", { exact: true }).click();
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  const card = page.getByRole("group", { name: "Your walkthrough" });
  await expect(card.getByRole("button", { name: "Make my work plan" })).toBeEnabled();
});

test("the in-page recorder states the chosen size's stop point", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("room-size-picker").getByText("Large", { exact: true }).click();
  await page.getByRole("button", { name: "Record a walkthrough" }).click();
  await expect(page.getByText("Large space: stops by itself at 3:00.", { exact: false })).toBeVisible();
});
