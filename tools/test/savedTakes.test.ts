/** Takes recorded here, kept on this device: index in localStorage, videos in a (fake) IndexedDB store. No network. */
import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  keepTake,
  listSavedTakes,
  openSavedTake,
  removeSavedTake,
  savedTakeFor,
  setTakeStoreForTests,
  takeSize,
  TAKES_INDEX_KEY,
  TAKES_MAX,
  TAKE_MAX_BYTES,
  type TakeStore,
} from "@/lib/client/savedTakes";
import { keptTakeNote, saveVideoFile, saveVideoMessage } from "@/lib/client/saveVideo";
import { fakeWindow, noWindow } from "./browser-stubs";

function fakeStore() {
  const data = new Map<string, unknown>();
  const s: TakeStore & { data: Map<string, unknown>; fail?: "quota" | "other"; failOnce?: boolean } = {
    data,
    get: async (id) => data.get(id),
    put: async (id, v) => {
      if (s.fail) {
        const kind = s.fail;
        if (s.failOnce) s.fail = undefined;
        const e = new Error(kind === "quota" ? "The quota has been exceeded." : "broken");
        e.name = kind === "quota" ? "QuotaExceededError" : "UnknownError";
        throw e;
      }
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

describe("saved takes", () => {
  test("keeps a take newest first with its name, size, time and length, and opens it again as the same video", async () => {
    const e = await keepTake(take("walkthrough-2026-11-02-1240.mp4", 42), { durationSec: 61.4, now: at(40) });
    assert.ok(e);
    assert.equal(e.name, "walkthrough-2026-11-02-1240.mp4");
    assert.equal(e.size, 42);
    assert.equal(e.durationSec, 61);
    assert.equal(e.savedAt, at(40).toISOString());
    assert.deepEqual(listSavedTakes().map((x) => x.id), [e.id]);
    const file = await openSavedTake(e.id);
    assert.ok(file instanceof File);
    assert.equal(file.name, "walkthrough-2026-11-02-1240.mp4");
    assert.equal(file.type, "video/mp4");
    assert.equal(file.size, 42);
  });

  test(`keeps only the newest ${TAKES_MAX} and deletes the older stored videos`, async () => {
    const ids: string[] = [];
    for (let i = 0; i < TAKES_MAX + 2; i++) ids.push((await keepTake(take(`t${i}.mp4`), { now: at(i) }))!.id);
    const list = listSavedTakes();
    assert.equal(list.length, TAKES_MAX);
    assert.deepEqual(list.map((x) => x.name), ["t4.mp4", "t3.mp4", "t2.mp4"]);
    assert.equal(store.data.size, TAKES_MAX);
    assert.equal(store.data.has(ids[0]), false);
    assert.equal(store.data.has(ids[1]), false);
  });

  test("storage full: clears the older takes and keeps the new one", async () => {
    await keepTake(take("old.mp4"), { now: at(1) });
    store.fail = "quota";
    store.failOnce = true;
    const e = await keepTake(take("new.mp4"), { now: at(2) });
    assert.ok(e);
    assert.deepEqual(listSavedTakes().map((x) => x.name), ["new.mp4"]);
    assert.equal(store.data.size, 1);
  });

  test("never throws: a broken store, no IndexedDB, no localStorage, an empty or huge take all resolve null", async () => {
    store.fail = "other";
    assert.equal(await keepTake(take("a.mp4")), null);
    store.fail = "quota";
    assert.equal(await keepTake(take("b.mp4")), null, "full with nothing older to clear");
    store.fail = undefined;
    assert.equal(await keepTake(take("empty.mp4", 0)), null);
    const huge = { name: "huge.mp4", size: TAKE_MAX_BYTES + 1, type: "video/mp4" } as File;
    assert.equal(await keepTake(huge), null);
    setTakeStoreForTests(null);
    assert.equal(await keepTake(take("c.mp4")), null);
    setTakeStoreForTests(store);
    noWindow();
    assert.equal(await keepTake(take("d.mp4")), null);
    assert.equal(store.data.size, 0, "a stored video with no list row is cleaned up");
    assert.deepEqual(listSavedTakes(), []);
  });

  test("Remove drops the row and its video; a row whose video is gone is taken off when opened", async () => {
    const a = (await keepTake(take("a.mp4"), { now: at(1) }))!;
    const b = (await keepTake(take("b.mp4"), { now: at(2) }))!;
    await removeSavedTake(a.id);
    assert.deepEqual(listSavedTakes().map((x) => x.id), [b.id]);
    assert.equal(store.data.has(a.id), false);
    store.data.delete(b.id);
    assert.equal(await openSavedTake(b.id), null);
    assert.deepEqual(listSavedTakes(), []);
  });

  test("a bad index is ignored", async () => {
    (globalThis as unknown as { window: Window }).window.localStorage.setItem(TAKES_INDEX_KEY, "{not json");
    assert.deepEqual(listSavedTakes(), []);
    (globalThis as unknown as { window: Window }).window.localStorage.setItem(TAKES_INDEX_KEY, JSON.stringify([{ id: 3 }, null]));
    assert.deepEqual(listSavedTakes(), []);
  });

  test("savedTakeFor matches the same file by name and size", async () => {
    const f = take("walkthrough-x.mp4", 7);
    await keepTake(f);
    assert.ok(savedTakeFor(listSavedTakes(), f));
    assert.equal(savedTakeFor(listSavedTakes(), take("walkthrough-x.mp4", 8)), null);
    assert.equal(savedTakeFor(listSavedTakes(), null), null);
  });

  test("sizes read plainly", () => {
    assert.equal(takeSize(900 * 1024), "900 KB");
    assert.equal(takeSize(48 * 1024 * 1024), "48 MB");
    assert.equal(takeSize(1.25 * 1024 ** 3), "1.3 GB");
    assert.equal(takeSize(0), "");
  });
});

describe("Save video", () => {
  const file = take("walkthrough.mp4");
  const nav = (share: (d: unknown) => Promise<void>, canShare = true) => ({ share, canShare: () => canShare });

  test("phone whose share sheet takes the video: opens the sheet with the file", async () => {
    let shared: unknown = null;
    let downloaded = false;
    const r = await saveVideoFile(file, {
      nav: nav(async (d) => void (shared = d)),
      preferShare: true,
      download: () => (downloaded = true),
    });
    assert.equal(r, "shared");
    assert.deepEqual((shared as { files: File[] }).files, [file]);
    assert.equal(downloaded, false);
  });

  test("a dismissed sheet is cancelled, never a download", async () => {
    let downloaded = false;
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    const r = await saveVideoFile(file, { nav: nav(async () => Promise.reject(abort)), preferShare: true, download: () => (downloaded = true) });
    assert.equal(r, "cancelled");
    assert.equal(downloaded, false);
    assert.equal(saveVideoMessage(r), "");
  });

  test("a stale tap asks for one more tap; the second tap shares again, and downloads if refused again", async () => {
    const refused = Object.assign(new Error("x"), { name: "NotAllowedError" });
    let downloads = 0;
    const env = { nav: nav(async () => Promise.reject(refused)), preferShare: true, download: () => Boolean(++downloads) };
    assert.equal(await saveVideoFile(file, env), "needs-tap");
    assert.equal(downloads, 0);
    assert.equal(await saveVideoFile(file, { ...env, retry: true }), "downloaded");
    assert.equal(downloads, 1);
  });

  test("Android without file sharing and computers download the file with its own name", async () => {
    let name = "";
    const r1 = await saveVideoFile(file, { nav: nav(async () => {}, false), preferShare: true, download: (_b, n) => Boolean((name = n)) });
    assert.equal(r1, "downloaded");
    assert.equal(name, "walkthrough.mp4");
    let shared = false;
    const r2 = await saveVideoFile(file, { nav: nav(async () => void (shared = true)), preferShare: false, download: () => true });
    assert.equal(r2, "downloaded");
    assert.equal(shared, false);
    const r3 = await saveVideoFile(file, { nav: {}, preferShare: false, download: () => { throw new Error("no"); } });
    assert.equal(r3, "failed");
  });

  test("plain notes under a take recorded here", () => {
    assert.equal(keptTakeNote(true, true), "Saved on this phone. Tap Save video to keep it in Photos.");
    assert.equal(keptTakeNote(true, false), "Saved in this browser. Tap Save video to download it.");
    assert.match(keptTakeNote(false, true), /Save video/);
  });
});
