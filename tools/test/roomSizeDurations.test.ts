import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  aimRange,
  aimRangeSpoken,
  aimText,
  checkDuration,
  DEFAULT_ROOM_SIZE,
  durationRulesFor,
  isRoomSize,
  LONGEST_TAKE_SEC,
  MIN_SEC,
  ROOM_SIZES,
  shortLength,
  spokenLength,
} from "@/lib/client/duration";
import { elapsedState, secondsLeft } from "@/lib/client/recorder";
import { loadRoomSize, ROOM_SIZE_KEY, saveRoomSize } from "@/lib/client/roomSize";
import { pickFrameTimes } from "@/lib/client/buildPlanRequest";
import { DENSE, planDenseTicks } from "@/lib/client/denseSampling";
import { fakeWindow, noWindow } from "./browser-stubs";

const EXPECTED = {
  small: { aimMinSec: 30, aimMaxSec: 60, warnAfterSec: 60, hardMaxSec: 75, aim: "Aim for 30–60 s, stops at 75 s" },
  medium: { aimMinSec: 60, aimMaxSec: 90, warnAfterSec: 95, hardMaxSec: 120, aim: "Aim for 60–90 s, stops at 2 min" },
  large: { aimMinSec: 90, aimMaxSec: 180, warnAfterSec: 150, hardMaxSec: 180, aim: "Aim for 90 s–3 min, stops at 3 min" },
  xl: { aimMinSec: 180, aimMaxSec: 300, warnAfterSec: 270, hardMaxSec: 300, aim: "Aim for 3–5 min, stops at 5 min" },
} as const;

describe("room size length rules (duration.ts)", () => {
  test("four sizes, in order, with Antonio's numbers and plain examples", () => {
    assert.deepEqual(ROOM_SIZES.map((r) => r.size), ["small", "medium", "large", "xl"]);
    assert.deepEqual(ROOM_SIZES.map((r) => r.label), ["Small", "Medium", "Large", "Extra large"]);
    for (const r of ROOM_SIZES) {
      const e = EXPECTED[r.size];
      assert.equal(r.aimMinSec, e.aimMinSec, r.size);
      assert.equal(r.aimMaxSec, e.aimMaxSec, r.size);
      assert.equal(r.warnAfterSec, e.warnAfterSec, r.size);
      assert.equal(r.hardMaxSec, e.hardMaxSec, r.size);
      assert.equal(r.minSec, MIN_SEC);
      assert.equal(aimText(r), e.aim);
      assert.ok(r.examples.length > 0);
      // Sensible order inside each size: min < aim range, warn at or under the cap.
      assert.ok(r.minSec < r.aimMinSec && r.aimMinSec < r.aimMaxSec && r.warnAfterSec < r.hardMaxSec && r.aimMaxSec <= r.hardMaxSec, r.size);
    }
    assert.match(durationRulesFor("small").examples, /Bedroom/);
    assert.match(durationRulesFor("xl").examples, /Warehouse/);
    assert.equal(LONGEST_TAKE_SEC, 300);
  });

  test("caps grow with size", () => {
    const caps = ROOM_SIZES.map((r) => r.hardMaxSec);
    assert.deepEqual([...caps].sort((a, b) => a - b), caps);
  });

  test("Medium is the default and the fallback for anything unknown", () => {
    assert.equal(DEFAULT_ROOM_SIZE, "medium");
    for (const v of [undefined, null, "", "huge", "MEDIUM"]) assert.equal(durationRulesFor(v as string).size, "medium");
    assert.ok(isRoomSize("xl"));
    assert.ok(!isRoomSize("extra"));
  });

  test("checkDuration per size: ok up to the warn point, warn up to the cap, block past it", () => {
    for (const r of ROOM_SIZES) {
      assert.equal(checkDuration(4.9, r.size).kind, "block", r.size);
      assert.deepEqual(checkDuration(r.minSec, r.size), { kind: "ok", durationSec: r.minSec });
      assert.equal(checkDuration(r.warnAfterSec, r.size).kind, "ok", r.size);
      assert.equal(checkDuration(r.warnAfterSec + 0.5, r.size).kind, "warn", r.size);
      assert.equal(checkDuration(r.hardMaxSec, r.size).kind, "warn", r.size);
      assert.equal(checkDuration(r.hardMaxSec + 0.1, r.size).kind, "block", r.size);
      for (const d of [NaN, 0, -1, Infinity]) assert.equal(checkDuration(d, r.size).kind, "block");
    }
  });

  test("the same 100 s take: warned for Medium, blocked for Small, fine for Large", () => {
    assert.equal(checkDuration(100, "small").kind, "block");
    assert.equal(checkDuration(100, "medium").kind, "warn");
    assert.equal(checkDuration(100, "large").kind, "ok");
    assert.equal(checkDuration(100, "xl").kind, "ok");
  });

  test("messages name the size, its aim, and the next size up when the take is too long", () => {
    const small = checkDuration(80, "small");
    assert.equal(small.kind, "block");
    assert.match(small.kind === "block" ? small.message : "", /over 75 seconds, the most for a small space\. Trim it to about 60 seconds.*pick Medium/);
    const large = checkDuration(200, "large");
    assert.match(large.kind === "block" ? large.message : "", /over 3 minutes.*Trim it to under 3 minutes.*pick Extra large/);
    const xl = checkDuration(301, "xl");
    assert.match(xl.kind === "block" ? xl.message : "", /over 5 minutes.*one walkthrough per area/);
    const warn = checkDuration(65, "small");
    assert.match(warn.kind === "warn" ? warn.message : "", /A bit long for a small space.*30 to 60 seconds/);
    const short = checkDuration(2, "xl");
    assert.match(short.kind === "block" ? short.message : "", /3 to 5 minutes/);
  });

  test("length wording", () => {
    assert.equal(shortLength(75), "75 s");
    assert.equal(shortLength(90), "90 s");
    assert.equal(shortLength(120), "2 min");
    assert.equal(spokenLength(150), "2½ minutes");
    assert.equal(spokenLength(300), "5 minutes");
    assert.equal(aimRange(durationRulesFor("large")), "90 s–3 min");
    assert.equal(aimRangeSpoken(durationRulesFor("large")), "90 seconds to 3 minutes");
    assert.equal(aimRangeSpoken(durationRulesFor("medium")), "60 to 90 seconds");
  });
});

describe("recorder follows the chosen size", () => {
  test("wrap-up hint at the size's warn point, automatic stop at its cap, countdown to the cap", () => {
    for (const r of ROOM_SIZES) {
      assert.equal(elapsedState(1, r), "short");
      assert.equal(elapsedState(r.warnAfterSec, r), "ok", r.size);
      assert.equal(elapsedState(r.warnAfterSec + 0.1, r), "long", r.size);
      assert.equal(elapsedState(r.hardMaxSec - 0.01, r), "long", r.size);
      assert.equal(elapsedState(r.hardMaxSec, r), "max", r.size);
      assert.equal(secondsLeft(r.hardMaxSec - 10.2, r), 11);
      assert.equal(secondsLeft(r.hardMaxSec + 5, r), 0);
    }
    // No rules passed: Medium.
    assert.equal(elapsedState(120), "max");
    assert.equal(secondsLeft(100), 20);
  });
});

describe("saved room size", () => {
  test("saved on this device; Medium when nothing (or junk) is saved", () => {
    noWindow();
    assert.equal(loadRoomSize(), "medium");
    const { store } = fakeWindow();
    assert.equal(loadRoomSize(), "medium");
    saveRoomSize("xl");
    assert.equal(store.get(ROOM_SIZE_KEY), "xl");
    assert.equal(loadRoomSize(), "xl");
    store.set(ROOM_SIZE_KEY, "gigantic");
    assert.equal(loadRoomSize(), "medium");
    noWindow();
  });
});

describe("frame spacing per size (sampling unchanged: at most 48 frames over the actual clip)", () => {
  const spacing = (sec: number) => {
    const t = pickFrameTimes(sec);
    return { n: t.length, gap: (t[t.length - 1] - t[0]) / (t.length - 1) };
  };
  test("every size's cap stays at or under 48 frames, spread over the whole clip", () => {
    for (const r of ROOM_SIZES) {
      const { n } = spacing(r.hardMaxSec);
      assert.ok(n <= 48, r.size);
      const t = pickFrameTimes(r.hardMaxSec);
      assert.ok(t[0] <= 0.25 && t[t.length - 1] >= r.hardMaxSec - 0.25, r.size);
    }
  });
  test("interval at each size's cap: about duration / 48 once the 2 s ticks would pass 48", () => {
    const at = (sec: number) => Math.round(spacing(sec).gap * 100) / 100;
    assert.equal(spacing(75).n, 38); // Small cap: 2 s ticks (fewer than 48 needed)
    assert.ok(Math.abs(at(75) - 2) < 0.05);
    assert.equal(spacing(60).n, 30); // Small aim max: 2 s ticks
    assert.equal(spacing(120).n, 48); // Medium cap
    assert.ok(Math.abs(at(120) - 119.5 / 47) < 0.01); // ~2.54 s
    assert.equal(spacing(180).n, 48); // Large cap
    assert.ok(Math.abs(at(180) - 179.5 / 47) < 0.01); // ~3.82 s
    assert.equal(spacing(300).n, 48); // Extra large cap
    assert.ok(Math.abs(at(300) - 299.5 / 47) < 0.01); // ~6.37 s
  });
  test("short takes keep the dense ~1.25 s sharpest-per-window sampling", () => {
    const dense = planDenseTicks(40, { frameBudgetBytes: 4_200_000, legacyCount: pickFrameTimes(40).length, maxFrames: 48 });
    assert.ok(dense, "40 s take is dense");
    const t = dense!.times;
    const gap = (t[t.length - 1] - t[0]) / (t.length - 1);
    // ~1.25 s windows, thinned only by the 30-frame dense cap (scene-change slots kept free): denser than 2 s.
    assert.ok(gap >= DENSE.intervalSec - 0.01 && gap < 2, String(gap));
    assert.ok(t.length > pickFrameTimes(40).length);
    assert.equal(planDenseTicks(60, { frameBudgetBytes: 4_200_000, legacyCount: pickFrameTimes(60).length, maxFrames: 48 }), null);
  });
});
