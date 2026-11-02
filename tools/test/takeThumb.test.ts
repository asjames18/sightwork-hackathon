/** Saved take still: which moment to show and the #t= source. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { THUMB_AT_SEC, takeThumbSrc, takeThumbTime } from "@/lib/client/takeThumb";

test("takeThumbTime: half a second in, or the middle of a very short take", () => {
  assert.equal(takeThumbTime(75), THUMB_AT_SEC);
  assert.equal(takeThumbTime(0.6), 0.3);
  assert.equal(takeThumbTime(null), THUMB_AT_SEC);
  assert.equal(takeThumbTime(undefined), THUMB_AT_SEC);
  assert.equal(takeThumbTime(0), THUMB_AT_SEC);
  assert.equal(takeThumbTime(-4), THUMB_AT_SEC);
  assert.equal(takeThumbTime(Number.NaN), THUMB_AT_SEC);
});

test("takeThumbSrc: object URL plus a #t= fragment, replacing any earlier fragment", () => {
  assert.equal(takeThumbSrc("blob:https://x.test/abc", 90), "blob:https://x.test/abc#t=0.5");
  assert.equal(takeThumbSrc("blob:https://x.test/abc#t=3", 0.4), "blob:https://x.test/abc#t=0.2");
});

test("takeThumbSrc: no URL gives an empty source", () => {
  assert.equal(takeThumbSrc(null), "");
  assert.equal(takeThumbSrc(undefined), "");
  assert.equal(takeThumbSrc(""), "");
});
