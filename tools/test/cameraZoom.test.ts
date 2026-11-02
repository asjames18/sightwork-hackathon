import { test } from "node:test";
import assert from "node:assert/strict";
import { wideZoomRange, setWideView, wideButtonLabel, wideZoomTag, type ZoomTrack } from "../../src/lib/client/cameraZoom";

const track = (
  caps: unknown,
  settings: unknown = { zoom: 1 },
  apply?: (c: MediaTrackConstraints) => Promise<void>,
): ZoomTrack & { calls: MediaTrackConstraints[] } => {
  const calls: MediaTrackConstraints[] = [];
  return {
    readyState: "live",
    calls,
    getCapabilities: () => caps,
    getSettings: () => settings,
    applyConstraints: async (c) => {
      calls.push(c);
      if (apply) await apply(c);
    },
  };
};

test("wideZoomRange: only when the camera can zoom out below where it opened", () => {
  assert.deepEqual(wideZoomRange(track({ zoom: { min: 0.5, max: 10 } })), { min: 0.5, max: 10, normal: 1 });
  assert.equal(wideZoomRange(track({ zoom: { min: 1, max: 8 } })), null);
  assert.equal(wideZoomRange(track({ zoom: { min: 0.95, max: 8 } })), null);
  assert.equal(wideZoomRange(track({ width: { max: 1920 } })), null);
  assert.equal(wideZoomRange(track(null)), null);
  assert.equal(wideZoomRange(null), null);
  assert.equal(wideZoomRange(undefined), null);
  assert.equal(wideZoomRange({ readyState: "live" }), null);
  assert.equal(wideZoomRange({ ...track({ zoom: { min: 0.5, max: 10 } }), readyState: "ended" }), null);
});

test("wideZoomRange: ignores broken ranges and throwing tracks", () => {
  assert.equal(wideZoomRange(track({ zoom: { min: "0.5", max: 10 } })), null);
  assert.equal(wideZoomRange(track({ zoom: { min: 0.5, max: 0.2 } })), null);
  assert.equal(wideZoomRange(track({ zoom: { min: 0, max: 10 } })), null);
  assert.equal(wideZoomRange(track({ zoom: { min: Number.NaN, max: 10 } })), null);
  const throws: ZoomTrack = { readyState: "live", getCapabilities: () => { throw new Error("x"); }, applyConstraints: async () => {} };
  assert.equal(wideZoomRange(throws), null);
});

test("wideZoomRange: normal zoom comes from settings, clamped, and falls back to 1", () => {
  assert.equal(wideZoomRange(track({ zoom: { min: 0.6, max: 10 } }, { zoom: 2 }))?.normal, 2);
  assert.equal(wideZoomRange(track({ zoom: { min: 0.6, max: 10 } }, {}))?.normal, 1);
  assert.equal(wideZoomRange(track({ zoom: { min: 0.6, max: 10 } }, { zoom: 50 }))?.normal, 10);
  const badSettings: ZoomTrack = { ...track({ zoom: { min: 0.5, max: 4 } }), getSettings: () => { throw new Error("x"); } };
  assert.equal(wideZoomRange(badSettings)?.normal, 1);
});

test("setWideView: asks for the widest zoom, then back to the opening zoom", async () => {
  const t = track({ zoom: { min: 0.5, max: 10 } }, { zoom: 1 });
  assert.equal(await setWideView(t, true), true);
  assert.deepEqual(t.calls[0], { advanced: [{ zoom: 0.5 }] });
  assert.equal(await setWideView(t, false), false);
  assert.deepEqual(t.calls[1], { advanced: [{ zoom: 1 }] });
});

test("setWideView: a refused request leaves the view as it was; no zoom means no call", async () => {
  const refuses = track({ zoom: { min: 0.5, max: 10 } }, { zoom: 1 }, async () => { throw new Error("OverconstrainedError"); });
  assert.equal(await setWideView(refuses, true), false);
  assert.equal(await setWideView(refuses, false), true);
  const none = track({});
  assert.equal(await setWideView(none, true), false);
  assert.equal(none.calls.length, 0);
});

test("labels: button says what a tap does; tag shows the phone's wide zoom", () => {
  assert.equal(wideButtonLabel(false), "Wide view");
  assert.equal(wideButtonLabel(true), "Normal view");
  assert.equal(wideZoomTag({ min: 0.5, max: 10, normal: 1 }), "0.5x");
  assert.equal(wideZoomTag({ min: 0.56, max: 10, normal: 1 }), "0.6x");
  assert.equal(wideZoomTag(null), null);
});
