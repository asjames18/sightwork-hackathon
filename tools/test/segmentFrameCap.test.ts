/** Segment step frame cap (f66a6ed): a frame over 5 MB decoded throws before any SAM call; exactly 5 MB reaches callSegment. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runSegment, validateSegmentInput, type SegmentDeps, type SegmentInput } from "@/lib/pipeline/segment";

const MB5 = 5 * 1024 * 1024;

/** data:image/jpeg URL whose decoded payload is exactly `bytes` bytes (JPEG SOI/APP0 header, zero padding). */
function jpegDataUrl(bytes: number): string {
  const buf = Buffer.alloc(bytes);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(buf, 0);
  return "data:image/jpeg;base64," + buf.toString("base64");
}

const SMALL = jpegDataUrl(64);

function input(frames: string[]): SegmentInput {
  return { frames: frames.map((dataUrl, i) => ({ tSec: i, dataUrl })) };
}

/** Deps whose callSegment counts calls and always throws, so no real call can happen. */
function deps(): { deps: SegmentDeps; calls: () => number } {
  let n = 0;
  return {
    deps: {
      callSegment: async () => {
        n += 1;
        throw new Error("test: callSegment reached");
      },
      tracker: { record: () => {} } as unknown as SegmentDeps["tracker"],
    },
    calls: () => n,
  };
}

describe("segment step frame cap", () => {
  test("a frame of 5 MB + 1 byte throws before any SAM call", async () => {
    const d = deps();
    await assert.rejects(runSegment(input([jpegDataUrl(MB5 + 1)]), d.deps), /frame 0 dataUrl must be at most 5 MB/);
    assert.equal(d.calls(), 0);
  });

  test("a frame of exactly 5 MB passes the cap and reaches callSegment", async () => {
    const d = deps();
    assert.doesNotThrow(() => validateSegmentInput(input([jpegDataUrl(MB5)])));
    await assert.rejects(runSegment(input([jpegDataUrl(MB5)]), d.deps), /callSegment reached/);
    assert.ok(d.calls() >= 1);
  });

  test("an over-cap second frame names frame 1 and makes no SAM call", async () => {
    const d = deps();
    await assert.rejects(runSegment(input([SMALL, jpegDataUrl(MB5 + 1)]), d.deps), /frame 1 dataUrl must be at most 5 MB/);
    assert.equal(d.calls(), 0);
  });

  test("a small frame passes validation", () => {
    assert.doesNotThrow(() => validateSegmentInput(input([SMALL])));
  });
});
