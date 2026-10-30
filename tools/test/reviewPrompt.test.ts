/**
 * Prompt 06 builder (src/lib/reviewPrompt.ts), offline: the filled prompt names every selected
 * photo in attach order, gives each problem its own photo letters and captions, says "proof: none"
 * when the photo cap or a bad frame leaves a problem without a photo, and carries REVIEW_SCHEMA.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildReviewPrompt, reviewTime, DEFAULT_REVIEW_SPACE_TYPE } from "@/lib/reviewPrompt";
import { buildReviewPhotos } from "@/lib/pipeline/runPlan";
import { REVIEW_SCHEMA } from "@/lib/pipeline/review";
import type { Issue } from "@/lib/types";

const issue = (rank: number, frameIndex: number, extra: Partial<Issue> = {}): Issue => ({
  rank,
  title: `Problem ${rank}`,
  detail: `Detail ${rank}.`,
  severity: "medium",
  frameIndex,
  frameTimeSec: frameIndex * 5,
  unmentioned: false,
  ...extra,
});

/** The planted plan: cable (seen), a smell (can't be seen), a loose tile (seen). */
const PLANTED: Issue[] = [
  issue(1, 6, { title: "Cable across the stage steps", severity: "high", proofFrames: [{ frameIndex: 6, tSec: 30, caption: "cable across center aisle" }] }),
  issue(2, 2, { title: "Musty smell behind the curtain", severity: "medium" }),
  issue(3, 9, { title: "Loose floor tile", severity: "low", proofFrames: [{ frameIndex: 9, tSec: 45 }, { frameIndex: 6, tSec: 30 }] }),
];
const FRAMES = Array.from({ length: 12 }, (_, i) => ({ tSec: i * 5 }));

const lines = (p: string) => p.split("\n");

describe("buildReviewPrompt (prompt 06)", () => {
  test("planted plan: photos in attach order, each problem's own letters and captions", () => {
    const photos = buildReviewPhotos(PLANTED, FRAMES);
    const p = buildReviewPrompt({ spaceType: "sanctuary", issues: PLANTED, photos });
    assert.match(p, /walkthrough video of a sanctuary\./);
    const l = lines(p);
    const a = l.indexOf("Photo A: frame 2 at 0:10");
    assert.ok(a > 0, "photo list starts with the earliest frame");
    assert.deepEqual(l.slice(a, a + 3), ["Photo A: frame 2 at 0:10", "Photo B: frame 6 at 0:30", "Photo C: frame 9 at 0:45"]);
    assert.ok(l.includes("Problems (3):"));
    assert.ok(l.includes("id 1 | high | Cable across the stage steps | Detail 1. | proof: Photo B (cable across center aisle)"));
    assert.ok(l.includes("id 2 | medium | Musty smell behind the curtain | Detail 2. | proof: Photo A"));
    assert.ok(l.includes("id 3 | low | Loose floor tile | Detail 3. | proof: Photo C, Photo B"));
  });

  test("no placeholder is left and the schema block is REVIEW_SCHEMA", () => {
    const p = buildReviewPrompt({ issues: PLANTED, photos: buildReviewPhotos(PLANTED, FRAMES) });
    assert.doesNotMatch(p, /\{\{\w+\}\}/);
    const schema = JSON.parse(p.slice(p.indexOf("no code fences:\n") + "no code fences:\n".length));
    assert.deepEqual(schema, REVIEW_SCHEMA);
    assert.match(p, /Set "ran" to true\./);
  });

  test("spaceType missing or blank falls back to the default", () => {
    for (const spaceType of [undefined, "", "   "]) {
      const p = buildReviewPrompt({ spaceType, issues: PLANTED, photos: [] });
      assert.match(p, new RegExp(`walkthrough video of a ${DEFAULT_REVIEW_SPACE_TYPE}\\.`));
    }
  });

  test("issues are listed in rank order whatever order they arrive in", () => {
    const p = buildReviewPrompt({ issues: [...PLANTED].reverse(), photos: buildReviewPhotos(PLANTED, FRAMES) });
    const ids = lines(p).filter((x) => x.startsWith("id ")).map((x) => x.split(" | ")[0]);
    assert.deepEqual(ids, ["id 1", "id 2", "id 3"]);
  });

  test("over the 8-photo cap: every problem keeps its first photo, a ninth problem gets proof: none", () => {
    const many = Array.from({ length: 9 }, (_, i) => issue(i + 1, i, { proofFrames: [{ frameIndex: i, tSec: i * 5 }, { frameIndex: 11, tSec: 55 }] }));
    const photos = buildReviewPhotos(many, FRAMES);
    assert.equal(photos.length, 8);
    const p = buildReviewPrompt({ issues: many, photos });
    const l = lines(p);
    for (let r = 1; r <= 8; r++) {
      const line = l.find((x) => x.startsWith(`id ${r} |`));
      assert.ok(line?.endsWith(`proof: Photo ${String.fromCharCode(64 + r)}`), `id ${r}: ${line}`);
    }
    assert.ok(l.find((x) => x.startsWith("id 9 |"))?.endsWith("proof: none"));
  });

  test("a frame outside the plan never becomes a photo; that problem says proof: none", () => {
    const bad = [issue(1, 40), issue(2, 3)];
    const p = buildReviewPrompt({ issues: bad, photos: buildReviewPhotos(bad, FRAMES) });
    const l = lines(p);
    assert.ok(l.includes("Photo A: frame 3 at 0:15"));
    assert.ok(l.find((x) => x.startsWith("id 1 |"))?.endsWith("proof: none"));
  });

  test("no photos at all: the photo list says so instead of being blank", () => {
    const p = buildReviewPrompt({ issues: PLANTED, photos: [] });
    assert.ok(lines(p).includes("(no photos)"));
    assert.equal(lines(p).filter((x) => x.endsWith("proof: none")).length, 3);
  });

  test("model text can't break a problem line or fill a placeholder", () => {
    const odd = [issue(1, 0, { title: "Cords | wires\nand {{schema}}", detail: "Line one.\n\nLine two | three", proofFrames: [{ frameIndex: 0, tSec: 0, caption: "two\ncords | here" }] })];
    const p = buildReviewPrompt({ issues: odd, photos: buildReviewPhotos(odd, FRAMES) });
    const line = lines(p).find((x) => x.startsWith("id 1 |"));
    assert.equal(line, "id 1 | medium | Cords / wires and {{schema}} | Line one. Line two / three | proof: Photo A (two cords / here)");
    assert.equal(p.split('"additionalProperties"').length - 1, 2, "schema filled exactly once");
  });

  test("reviewTime formats m:ss and never goes negative", () => {
    assert.equal(reviewTime(0), "0:00");
    assert.equal(reviewTime(29.6), "0:30");
    assert.equal(reviewTime(75), "1:15");
    assert.equal(reviewTime(-3), "0:00");
    assert.equal(reviewTime(Number.NaN), "0:00");
  });
});
