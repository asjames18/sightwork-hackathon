/** Best pick among saved takes by length fit to the chosen room size. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { bestTake } from "@/lib/client/takeBest";

const t = (id: string, durationSec: number | null) => ({ id, durationSec });

test("bestTake: nothing with fewer than two takes or no usable length", () => {
  assert.equal(bestTake([], "medium"), null);
  assert.equal(bestTake([t("a", 75)], "medium"), null);
  assert.equal(bestTake([t("a", null), t("b", 0)], "medium"), null);
  assert.equal(bestTake([t("a", 2), t("b", 130)], "medium"), null, "too short and too long are never picked");
  assert.equal(bestTake(null as unknown as [], "medium"), null);
});

test("bestTake: good beats near the limit beats short; blocked never wins", () => {
  assert.equal(bestTake([t("short", 40), t("good", 75), t("long", 100)], "medium")?.id, "good");
  assert.equal(bestTake([t("short", 40), t("long", 100), t("block", 130)], "medium")?.id, "long");
  assert.equal(bestTake([t("block", 2), t("short", 40)], "medium")?.id, "short");
});

test("bestTake: within a tone, closest to the middle, shorter near the limit, longer when short", () => {
  assert.equal(bestTake([t("a", 62), t("b", 78), t("c", 90)], "medium")?.id, "b");
  assert.equal(bestTake([t("a", 115), t("b", 100)], "medium")?.id, "b");
  assert.equal(bestTake([t("a", 20), t("b", 50)], "medium")?.id, "b");
  assert.equal(bestTake([t("newest", 75), t("older", 75)], "medium")?.id, "newest", "ties go to the newest");
});

test("bestTake: follows the room size and names it", () => {
  const takes = [t("a", 70), t("b", 140)];
  assert.equal(bestTake(takes, "medium")?.id, "a");
  const large = bestTake(takes, "large");
  assert.equal(large?.id, "b");
  assert.equal(large?.text, "Best pick for Large");
  assert.match(large?.aria ?? "", /large space/);
  assert.equal(bestTake(takes, "nope")?.text, "Best pick for Medium");
});
