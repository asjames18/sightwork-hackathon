/** Reason step frame cap (3299ce0): a frame over 5 MB decoded throws before any Spark call; exactly 5 MB reaches callSpark. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runReason, validateReasonRequest, type ReasonDeps, type ReasonInput } from "@/lib/pipeline/reason";

const MB5 = 5 * 1024 * 1024;

/** data:image/jpeg URL whose decoded payload is exactly `bytes` bytes (JPEG SOI/APP0 header, zero padding). */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const SMALL = jpegDataUrl(64);

function input(frames: string[]): ReasonInput {
  return {
    frames: frames.map((dataUrl, i) => ({ tSec: i, dataUrl })),
    segmentation: null,
    transcript: null,
    durationSec: frames.length,
  };
}

/** Deps whose callSpark counts calls and always throws, so no real call can happen. */
function deps(): { deps: ReasonDeps; calls: () => number } {
  let n = 0;
  return {
    deps: {
      prompt: "p",
      schema: {},
      callSpark: async () => {
        n += 1;
        throw new Error("test: callSpark reached");
      },
      tracker: { record: () => {} } as unknown as ReasonDeps["tracker"],
    },
    calls: () => n,
  };
}

describe("reason step frame cap", () => {
  test("a frame of 5 MB + 1 byte throws before any Spark call", async () => {
    const d = deps();
    await assert.rejects(runReason(input([jpegDataUrl(MB5 + 1)]), d.deps), /frame 0 dataUrl must be at most 5 MB/);
    assert.equal(d.calls(), 0);
  });

  test("a frame of exactly 5 MB passes the cap and reaches callSpark", async () => {
    const d = deps();
    assert.doesNotThrow(() => validateReasonRequest(input([jpegDataUrl(MB5)]), d.deps));
    await assert.rejects(runReason(input([jpegDataUrl(MB5)]), d.deps), /callSpark reached/);
    assert.equal(d.calls(), 1);
  });

  test("an over-cap second frame names frame 1 and makes no Spark call", async () => {
    const d = deps();
    await assert.rejects(runReason(input([SMALL, jpegDataUrl(MB5 + 1)]), d.deps), /frame 1 dataUrl must be at most 5 MB/);
    assert.equal(d.calls(), 0);
  });

  test("a small frame passes validation", () => {
    assert.doesNotThrow(() => validateReasonRequest(input([SMALL]), deps().deps));
  });
});
