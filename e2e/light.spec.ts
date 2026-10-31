import path from "node:path";
import { test, expect, FIXTURES, WALKTHROUGH, BLANK_CLIP, expectNoAxeViolations, expectNoSideScroll } from "./helpers";

/** 6 s test picture dimmed to a dark-room level (not black), with a tone. */
const DARK_CLIP = path.join(FIXTURES, "dark-6s.webm");

test("a dark walkthrough gets a soft warning on the upload card and can still go ahead", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("choose-video-input").setInputFiles(DARK_CLIP);
  const warning = page.getByTestId("light-warning");
  await expect(warning).toContainText("looks dark for most of the walk");
  await expect(warning).toHaveAttribute("role", "status");
  const make = page.getByRole("button", { name: "Make my work plan" });
  await expect(make).toBeEnabled();
  await expectNoSideScroll(page);
  await expectNoAxeViolations(page, "dark video warning");
  await make.click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Film a walkthrough. Get a work plan.");
});

test("a well lit walkthrough shows no light warning", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("choose-video-input").setInputFiles(WALKTHROUGH);
  await expect(page.getByRole("button", { name: "Make my work plan" })).toBeEnabled();
  // Give the on-device check time to finish before saying it stayed quiet.
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("light-warning")).toHaveCount(0);
});

test("a black take is flagged on the card before any run", async ({ page }) => {
  await page.goto("/start");
  await page.getByTestId("choose-video-input").setInputFiles(BLANK_CLIP);
  await expect(page.getByTestId("light-warning")).toContainText("looks black from start to end");
});
