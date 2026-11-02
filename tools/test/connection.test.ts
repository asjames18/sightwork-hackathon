/** The offline note on the processing screen (connection.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineNote, readOnline } from "@/lib/client/connection";

test("no note while online", () => {
  assert.equal(offlineNote(true, { real: true, failed: false }), null);
  assert.equal(offlineNote(true, { real: true, failed: true }), null);
});

test("no note for an example run, which needs no network", () => {
  assert.equal(offlineNote(false, { real: false, failed: false }), null);
  assert.equal(offlineNote(false, { real: false, failed: true }), null);
});

test("a real run in progress says to stay on the screen", () => {
  const note = offlineNote(false, { real: true, failed: false });
  assert.match(note ?? "", /^You're offline\. The plan needs a connection to finish/);
  assert.match(note ?? "", /reconnect and tap Try again\.$/);
});

test("a stopped real run says to reconnect, then try again", () => {
  assert.equal(
    offlineNote(false, { real: true, failed: true }),
    "You're offline. Reconnect to Wi-Fi or mobile data, then tap Try again.",
  );
});

test("readOnline treats anything but an explicit false as online", () => {
  assert.equal(readOnline(undefined), true);
  assert.equal(readOnline({}), true);
  assert.equal(readOnline({ onLine: true }), true);
  assert.equal(readOnline({ onLine: "no" }), true);
  assert.equal(readOnline({ onLine: false }), false);
});
