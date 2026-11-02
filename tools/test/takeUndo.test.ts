/** Undo for a removed saved take: the row and its stored video come back where they were. No network. */
import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  keepTake,
  listSavedTakes,
  openSavedTake,
  removeSavedTakeWithUndo,
  restoreSavedTake,
  setTakeStoreForTests,
  TAKES_MAX,
  type TakeStore,
} from "@/lib/client/savedTakes";
import { fakeWindow, noWindow } from "./browser-stubs";

function fakeStore() {
  const data = new Map<string, unknown>();
  const s: TakeStore & { data: Map<string, unknown>; failPut?: boolean } = {
    data,
    get: async (id) => data.get(id),
    put: async (id, v) => {
      if (s.failPut) throw new Error("broken");
      data.set(id, v);
    },
    remove: async (id) => void data.delete(id),
  };
  return s;
}

const take = (name: string, bytes = 10) => new File([new Uint8Array(bytes)], name, { type: "video/mp4" });
const at = (min: number) => new Date(Date.UTC(2026, 10, 2, 17, min));

let store: ReturnType<typeof fakeStore>;
beforeEach(() => {
  fakeWindow();
  store = fakeStore();
  setTakeStoreForTests(store);
});
afterEach(() => {
  setTakeStoreForTests(undefined);
  noWindow();
});

describe("saved take undo", () => {
  test("remove takes the row and video off, undo puts both back in the same place", async () => {
    const a = await keepTake(take("a.mp4", 11), { now: at(1) });
    const b = await keepTake(take("b.mp4", 12), { now: at(2) });
    const c = await keepTake(take("c.mp4", 13), { now: at(3) });
    assert.ok(a && b && c);
    assert.deepEqual(listSavedTakes().map((e) => e.name), ["c.mp4", "b.mp4", "a.mp4"]);
    const removed = await removeSavedTakeWithUndo(b.id);
    assert.ok(removed);
    assert.equal(removed.position, 1);
    assert.deepEqual(listSavedTakes().map((e) => e.name), ["c.mp4", "a.mp4"]);
    assert.equal(store.data.has(b.id), false);
    assert.equal(await restoreSavedTake(removed), true);
    assert.deepEqual(listSavedTakes().map((e) => e.name), ["c.mp4", "b.mp4", "a.mp4"]);
    const file = await openSavedTake(b.id);
    assert.ok(file);
    assert.equal(file.name, "b.mp4");
    assert.equal(file.size, 12);
  });

  test("a take that was already gone has nothing to undo", async () => {
    const a = await keepTake(take("a.mp4"), { now: at(1) });
    assert.ok(a);
    store.data.delete(a.id);
    assert.equal(await removeSavedTakeWithUndo(a.id), null);
    assert.equal(listSavedTakes().length, 0);
    assert.equal(await removeSavedTakeWithUndo("nope"), null);
  });

  test("undo after a new take was recorded when the list is full again resolves false and keeps every newer take", async () => {
    const kept = [];
    for (let i = 0; i < TAKES_MAX; i++) kept.push(await keepTake(take(`t${i}.mp4`), { now: at(i) }));
    const last = kept[0];
    assert.ok(last);
    const removed = await removeSavedTakeWithUndo(last.id); // oldest, at the end
    assert.ok(removed);
    assert.equal(removed.position, TAKES_MAX - 1);
    const fresh = await keepTake(take("fresh.mp4"), { now: at(30) });
    assert.ok(fresh);
    assert.equal(listSavedTakes().length, TAKES_MAX);
    // The list is full again, so it can't come back without pushing another take off.
    assert.equal(await restoreSavedTake(removed), false);
    assert.equal(listSavedTakes().length, TAKES_MAX);
    assert.equal(listSavedTakes()[0].name, "fresh.mp4");
    for (const e of listSavedTakes()) assert.ok(store.data.has(e.id));
  });

  test("undo fails quietly when storage can't take the video back, and on bad input", async () => {
    const a = await keepTake(take("a.mp4"), { now: at(1) });
    assert.ok(a);
    const removed = await removeSavedTakeWithUndo(a.id);
    assert.ok(removed);
    store.failPut = true;
    assert.equal(await restoreSavedTake(removed), false);
    assert.equal(listSavedTakes().length, 0);
    store.failPut = false;
    assert.equal(await restoreSavedTake(null as never), false);
    assert.equal(await restoreSavedTake({ ...removed, stored: { ...removed.stored, blob: new Blob([]) } }), false);
    assert.equal(await restoreSavedTake(removed), true);
    assert.equal(listSavedTakes().length, 1);
  });
});
