/** Route validator frame cap (c45905a): a frame over 5 MB decoded is a problems-list entry; exactly 5 MB passes. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PLAN_FRAME_IMAGE_BYTES, validatePlanRequest } from "@/lib/pipeline/planRequest";

const MB5 = 5 * 1024 * 1024;

/** data:image/jpeg URL whose decoded payload is exactly `bytes` bytes (JPEG SOI/APP0 header, zero padding). */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const SMALL = jpegDataUrl(64);

function req(urls: string[]) {
  return { durationSec: urls.length, frames: urls.map((dataUrl, i) => ({ tSec: i, dataUrl })) };
}

test("the cap constant is 5 MB", () => {
  assert.equal(MAX_PLAN_FRAME_IMAGE_BYTES, MB5);
});

test("a small JPEG frame passes", () => {
  assert.deepEqual(validatePlanRequest(req([SMALL])), []);
});

test("a frame of exactly 5 MB decoded passes", () => {
  assert.deepEqual(validatePlanRequest(req([jpegDataUrl(MB5)])), []);
});

test("a frame of 5 MB + 1 byte is reported with its decoded size", () => {
  assert.deepEqual(validatePlanRequest(req([jpegDataUrl(MB5 + 1)])), [
    `frames[0].dataUrl must be at most 5 MB, got ${MB5 + 1} bytes`,
  ]);
});

test("an over-cap second frame names frames[1] and leaves the first alone", () => {
  assert.deepEqual(validatePlanRequest(req([SMALL, jpegDataUrl(MB5 + 2)])), [
    `frames[1].dataUrl must be at most 5 MB, got ${MB5 + 2} bytes`,
  ]);
});

test("a non-image payload keeps its own message, not the size message", () => {
  const notImage = "data:image/jpeg;base64," + Buffer.alloc(64, 1).toString("base64");
  assert.deepEqual(validatePlanRequest(req([notImage])), [
    "frames[0].dataUrl must carry image data (JPEG, PNG, WebP, or GIF)",
  ]);
});
