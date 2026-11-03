/** No-after-picture note (afterPictureNote.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { afterPictureNote, NO_AFTER_PICTURE_TEXT } from "@/lib/client/afterPictureNote";

test("a skipped after picture gets the note", () => {
  assert.equal(afterPictureNote({ afterImageUrl: null, meta: { skipped: { afterImage: true } } } as never), NO_AFTER_PICTURE_TEXT);
  assert.equal(afterPictureNote({ meta: { skipped: { afterImage: true } } } as never), NO_AFTER_PICTURE_TEXT);
});

test("a plan with its picture gets no note", () => {
  assert.equal(afterPictureNote({ afterImageUrl: "data:image/png;base64,AAAA", meta: { skipped: { afterImage: true } } } as never), null);
  assert.equal(afterPictureNote({ afterImageUrl: "https://x/y.png", meta: {} } as never), null);
});

test("other skipped steps or no meta give no note", () => {
  assert.equal(afterPictureNote({ afterImageUrl: null, meta: { skipped: { masks: true } } } as never), null);
  assert.equal(afterPictureNote({ afterImageUrl: null, meta: { skipped: { afterImage: false } } } as never), null);
  assert.equal(afterPictureNote({ afterImageUrl: null } as never), null);
});
