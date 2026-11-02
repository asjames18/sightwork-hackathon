import { test } from "node:test";
import assert from "node:assert/strict";
import { proofZoom, proofZoomLabel, proofZoomStatus, proofZoomStyle, ZOOM_MAX, ZOOM_MIN } from "../../src/lib/client/proofZoom";

test("a small box zooms in more, capped at 4x, and is centered", () => {
  const z = proofZoom([450, 450, 550, 550]);
  assert.equal(z.scale, ZOOM_MAX);
  assert.equal(z.centerX, 50);
  assert.equal(z.centerY, 50);
  const mid = proofZoom([300, 400, 600, 600]);
  assert.equal(mid.scale, 2);
  assert.equal(mid.centerX, 45);
  assert.equal(mid.centerY, 50);
});

test("a big box still zooms at least 1.5x, and the view never runs past the photo's edges", () => {
  assert.equal(proofZoom([0, 0, 1000, 1000]).scale, ZOOM_MIN);
  const corner = proofZoom([0, 0, 100, 100]);
  assert.equal(corner.scale, 4);
  assert.equal(corner.centerX, 12.5);
  assert.equal(corner.centerY, 12.5);
  const far = proofZoom([900, 950, 1000, 1000]);
  assert.equal(far.centerX, 87.5);
  assert.equal(far.centerY, 87.5);
  // Reversed corners read the same as the right way round.
  assert.deepEqual(proofZoom([550, 550, 450, 450]), proofZoom([450, 450, 550, 550]));
});

test("no usable box zooms 2x on the middle", () => {
  for (const box of [undefined, null, [1, 2, 3], [0, 0, 0, 0], [0, 0, Number.NaN, 5], "box"]) {
    assert.deepEqual(proofZoom(box), { scale: 2, centerX: 50, centerY: 50 });
  }
});

test("style, label and status words", () => {
  assert.deepEqual(proofZoomStyle({ scale: 2, centerX: 45, centerY: 50 }), {
    transformOrigin: "45% 50%",
    transform: "translate(5%, 0%) scale(2)",
  });
  assert.equal(proofZoomLabel(false), "Zoom in");
  assert.equal(proofZoomLabel(true), "Zoom out");
  assert.equal(proofZoomStatus(true, { scale: 2.5, centerX: 50, centerY: 50 }, true), "Zoomed in 2.5 times on the outline.");
  assert.equal(proofZoomStatus(true, { scale: 2, centerX: 50, centerY: 50 }, false), "Zoomed in 2 times on the middle of the photo.");
  assert.equal(proofZoomStatus(false, { scale: 2, centerX: 50, centerY: 50 }, true), "Zoomed out. The whole photo is in view.");
});
