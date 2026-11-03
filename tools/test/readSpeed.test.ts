import { test } from "node:test";
import assert from "node:assert/strict";
import {
  READ_SPEED_KEY,
  loadReadSpeed,
  nextReadSpeed,
  parseReadSpeed,
  readSpeedLabel,
  readSpeedRate,
  readSpeedStatus,
  saveReadSpeed,
} from "../../src/lib/client/readSpeed";

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}

test("parseReadSpeed: only the three known speeds, anything else is normal", () => {
  assert.equal(parseReadSpeed("slower"), "slower");
  assert.equal(parseReadSpeed("faster"), "faster");
  assert.equal(parseReadSpeed("normal"), "normal");
  for (const bad of ["", "FAST", "2", null, undefined, 1, {}, []]) assert.equal(parseReadSpeed(bad), "normal");
});

test("readSpeedRate: slower is under 1, normal is 1, faster is over 1", () => {
  assert.equal(readSpeedRate("normal"), 1);
  assert.ok(readSpeedRate("slower") < 1 && readSpeedRate("slower") >= 0.5);
  assert.ok(readSpeedRate("faster") > 1 && readSpeedRate("faster") <= 1.5);
});

test("nextReadSpeed cycles normal, faster, slower, normal", () => {
  assert.equal(nextReadSpeed("normal"), "faster");
  assert.equal(nextReadSpeed("faster"), "slower");
  assert.equal(nextReadSpeed("slower"), "normal");
});

test("label and status say where you are", () => {
  assert.equal(readSpeedLabel("normal"), "Speed: Normal");
  assert.equal(readSpeedLabel("faster"), "Speed: Faster");
  assert.equal(readSpeedStatus("slower"), "Reading speed set to slower.");
  assert.equal(readSpeedStatus("faster", true), "Reading speed set to faster. It starts with the next reading.");
});

test("save and load: kept on the device, normal clears it, bad or blocked storage is normal", () => {
  const s = memoryStore();
  saveReadSpeed("faster", s);
  assert.equal(s.data[READ_SPEED_KEY], "faster");
  assert.equal(loadReadSpeed(s), "faster");
  saveReadSpeed("normal", s);
  assert.equal(READ_SPEED_KEY in s.data, false);
  assert.equal(loadReadSpeed(memoryStore({ [READ_SPEED_KEY]: "warp" })), "normal");
  assert.equal(loadReadSpeed(null), "normal");
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(loadReadSpeed(broken), "normal");
  assert.doesNotThrow(() => saveReadSpeed("slower", broken));
});
