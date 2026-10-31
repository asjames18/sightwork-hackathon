import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkPlan } from "@/lib/types";
import { noNarrationNote, noNarrationTag, transcribeFailed } from "@/lib/client/narrationNote";

const base = { transcript: null, transcriptTurns: [], generatedFrom: "Walkthrough video, 8 frames, 33 s" } as unknown as WorkPlan;
const failed = { ...base, meta: { skipped: { transcribe: true } } } as unknown as WorkPlan;

test("a silent video keeps the original no-narration note", () => {
  assert.equal(transcribeFailed(base), false);
  assert.equal(noNarrationTag(base), "no narration");
  assert.match(noNarrationNote(base).lead, /^No narration in this video/);
  assert.match(noNarrationNote(base).hint, /next time/);
});

test("a failed transcribe call never claims the video had no speech", () => {
  assert.equal(transcribeFailed(failed), true);
  assert.equal(noNarrationTag(failed), "narration not transcribed");
  const note = noNarrationNote(failed);
  assert.match(note.lead, /couldn't transcribe the narration this run/);
  assert.doesNotMatch(note.lead + note.hint, /No narration in this video/);
  assert.match(note.hint, /Run it again/);
});

test("other skipped steps don't change the narration wording", () => {
  const p = { ...base, meta: { skipped: { cost: true, masks: true } } } as unknown as WorkPlan;
  assert.equal(noNarrationTag(p), "no narration");
});
