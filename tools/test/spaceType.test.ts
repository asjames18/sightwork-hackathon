/** Space type picker (richer findings, item 3): what each pick sends, and the saved choice. Offline. */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { cleanSpaceName, loadSpaceChoice, saveSpaceChoice, savedSpaceRequestFields, spaceRequestFields, SPACE_KEY, SPACE_NAME_MAX, SPACE_TYPES } from "@/lib/client/spaceType";
import { fakeWindow, noWindow } from "./browser-stubs";

afterEach(noWindow);

describe("space type", () => {
  test("nothing picked sends neither field, so the server keeps its own defaults", () => {
    assert.deepEqual(spaceRequestFields({ typeId: "", name: "" }), {});
    assert.deepEqual(spaceRequestFields(null), {});
    assert.deepEqual(spaceRequestFields({ typeId: "", name: "   " }), {});
  });
  test("a pick sends the prompt's space type and names the plan after it", () => {
    assert.deepEqual(spaceRequestFields({ typeId: "sanctuary", name: "" }), { spaceType: "church sanctuary", spaceName: "Sanctuary" });
    assert.deepEqual(spaceRequestFields({ typeId: "kitchen", name: " Fellowship  kitchen " }), { spaceType: "kitchen", spaceName: "Fellowship kitchen" });
    // "Other" keeps the generic type and doesn't invent a title.
    assert.deepEqual(spaceRequestFields({ typeId: "other", name: "" }), { spaceType: "room" });
    // A typed name with no type still names the plan; an unknown id is ignored.
    assert.deepEqual(spaceRequestFields({ typeId: "garage", name: "Youth room" }), { spaceName: "Youth room" });
  });
  test("every option has a non-blank type and a unique id", () => {
    assert.equal(new Set(SPACE_TYPES.map((o) => o.id)).size, SPACE_TYPES.length);
    for (const o of SPACE_TYPES) assert.ok(o.spaceType.trim() && o.label.trim() && o.defaultName.trim());
  });
  test("names are cleaned and capped on a word", () => {
    assert.equal(cleanSpaceName("a\u0000b\n c"), "a b c");
    const long = cleanSpaceName("word ".repeat(30));
    assert.ok(long.length <= SPACE_NAME_MAX && !long.endsWith(" "));
  });
  test("the choice is saved on the device and read when a run starts", () => {
    const { store } = fakeWindow();
    assert.deepEqual(loadSpaceChoice(), { typeId: "", name: "" });
    saveSpaceChoice({ typeId: "classroom", name: "Room 4" });
    assert.deepEqual(loadSpaceChoice(), { typeId: "classroom", name: "Room 4" });
    assert.deepEqual(savedSpaceRequestFields(), { spaceType: "classroom", spaceName: "Room 4" });
    saveSpaceChoice({ typeId: "", name: "" });
    assert.equal(store.has(SPACE_KEY), false);
    store.set(SPACE_KEY, "{not json");
    assert.deepEqual(loadSpaceChoice(), { typeId: "", name: "" });
    store.set(SPACE_KEY, JSON.stringify({ typeId: "spaceship", name: 4 }));
    assert.deepEqual(loadSpaceChoice(), { typeId: "", name: "" });
  });
  test("no window (server render): blanks, no throw", () => {
    assert.deepEqual(loadSpaceChoice(), { typeId: "", name: "" });
    assert.deepEqual(savedSpaceRequestFields(), {});
  });
});
