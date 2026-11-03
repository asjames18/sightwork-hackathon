import test from "node:test";
import assert from "node:assert/strict";
import { beforeStartNotes, beforeStartSummary } from "../../src/lib/client/beforeStart";

test("steps with no heads-up give no notes and no summary", () => {
  const notes = beforeStartNotes([{ order: 1, title: "Clear the main aisle", detail: "Stack the chairs along the wall." }]);
  assert.deepEqual(notes, []);
  assert.equal(beforeStartSummary(notes), "");
  assert.deepEqual(beforeStartNotes([]), []);
});

test("the same kind of heads-up on two steps is one note listing both steps in plan order", () => {
  const notes = beforeStartNotes([
    { order: 1, title: "Prime and paint the walls", detail: "Two coats." },
    { order: 2, title: "Clear the aisle", detail: "Stack chairs." },
    { order: 3, title: "Paint the trim", detail: "One coat of paint." },
  ]);
  const dry = notes.find((n) => n.key === "dry");
  assert.ok(dry);
  assert.deepEqual(dry.steps, [1, 3]);
  assert.ok(dry.hint.length > 10);
});

test("shut-off notes come first and are grouped by what to switch off", () => {
  const notes = beforeStartNotes([
    { order: 1, title: "Paint the walls", detail: "Two coats.", trade: "Volunteer" },
    { order: 2, title: "Move the outlet", detail: "Run new wire.", trade: "Electrician" },
    { order: 3, title: "Swap the valve", detail: "Replace the valve.", trade: "Plumber" },
    { order: 4, title: "Rewire the panel", detail: "New breaker.", trade: "Electrician" },
  ]);
  assert.equal(notes[0].key.startsWith("off:"), true);
  const power = notes.find((n) => n.label === "Power off first");
  assert.deepEqual(power?.steps, [2, 4]);
  assert.deepEqual(notes.find((n) => n.label === "Water off first")?.steps, [3]);
  const firstOther = notes.findIndex((n) => !n.key.startsWith("off:"));
  assert.ok(notes.slice(0, firstOther === -1 ? notes.length : firstOther).every((n) => n.key.startsWith("off:")));
});

test("a step never counts twice for one kind, and a bad step number is skipped", () => {
  const notes = beforeStartNotes([
    { order: 2, title: "Paint and prime", detail: "Paint the paint." },
    { order: Number.NaN, title: "Paint", detail: "Paint." },
  ]);
  assert.deepEqual(notes.find((n) => n.key === "dry")?.steps, [2]);
});

test("old-material steps do not also list the dust note", () => {
  const notes = beforeStartNotes([{ order: 1, title: "Scrape and sand the old paint", detail: "Scrape the peeling paint off the old plaster, then sand." }]);
  const keys = notes.map((n) => n.key);
  if (keys.includes("old")) assert.equal(keys.includes("dust"), false);
});

test("summary counts the notes", () => {
  assert.equal(beforeStartSummary([{ key: "a", label: "A", hint: "h", steps: [1] }]), "1 thing to plan for");
  assert.equal(
    beforeStartSummary([
      { key: "a", label: "A", hint: "h", steps: [1] },
      { key: "b", label: "B", hint: "h", steps: [2] },
    ]),
    "2 things to plan for",
  );
});
