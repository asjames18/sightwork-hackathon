import { test } from "node:test";
import assert from "node:assert/strict";
import { torchSupported, setTorch, torchButtonLabel, darkHintWithTorch, type TorchTrack } from "../../src/lib/client/torch";

const track = (caps: unknown, apply?: (c: MediaTrackConstraints) => Promise<void>): TorchTrack & { calls: MediaTrackConstraints[] } => {
  const calls: MediaTrackConstraints[] = [];
  return {
    readyState: "live",
    calls,
    getCapabilities: () => caps,
    applyConstraints: async (c) => {
      calls.push(c);
      if (apply) await apply(c);
    },
  };
};

test("torchSupported: only when the live track reports torch", () => {
  assert.equal(torchSupported(track({ torch: true })), true);
  assert.equal(torchSupported(track({ torch: [false, true] })), true);
  assert.equal(torchSupported(track({ torch: false })), false);
  assert.equal(torchSupported(track({ width: { max: 1920 } })), false);
  assert.equal(torchSupported(track(null)), false);
  assert.equal(torchSupported(null), false);
  assert.equal(torchSupported(undefined), false);
  assert.equal(torchSupported({ readyState: "live" }), false);
  assert.equal(torchSupported({ ...track({ torch: true }), readyState: "ended" }), false);
  const throws: TorchTrack = { readyState: "live", getCapabilities: () => { throw new Error("x"); }, applyConstraints: async () => {} };
  assert.equal(torchSupported(throws), false);
});

test("setTorch: asks for torch through advanced constraints and reports the result", async () => {
  const t = track({ torch: true });
  assert.equal(await setTorch(t, true), true);
  assert.deepEqual(t.calls[0], { advanced: [{ torch: true }] });
  assert.equal(await setTorch(t, false), false);
  assert.deepEqual(t.calls[1], { advanced: [{ torch: false }] });
});

test("setTorch: a refused request leaves the light as it was", async () => {
  const t = track({ torch: true }, async () => { throw new Error("NotReadableError"); });
  assert.equal(await setTorch(t, true), false);
  assert.equal(await setTorch(t, false), true);
});

test("setTorch: no light on the phone means no call and off", async () => {
  const t = track({});
  assert.equal(await setTorch(t, true), false);
  assert.equal(t.calls.length, 0);
});

test("torchButtonLabel and darkHintWithTorch", () => {
  assert.equal(torchButtonLabel(false), "Light on");
  assert.equal(torchButtonLabel(true), "Light off");
  const base = "It's dark here.";
  assert.equal(darkHintWithTorch(base, false, false), base);
  assert.equal(darkHintWithTorch(base, true, true), base);
  assert.equal(darkHintWithTorch(base, true, false), "It's dark here. Or tap Light on to use the phone's light.");
});
