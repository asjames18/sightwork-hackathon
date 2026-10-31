import { test } from "node:test";
import assert from "node:assert/strict";
import { findResponseJson, lastJsonBlock, outputTextParts } from "@/lib/responseJson";

const PLAN = { region: "Atlanta, GA", unitCosts: [{ label: "cord cover", low: 18, high: 32 }] };
const PROSE = "Fixing your Atlanta price ranges — gathering retail costs for covers, tape, and access.";

function msg(...texts: string[]) {
  return { type: "message", role: "assistant", content: texts.map((text) => ({ type: "output_text", text })) };
}

test("a single JSON message parses as before", () => {
  const r = findResponseJson({ output: [msg(JSON.stringify(PLAN))] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.json, PLAN);
});

test("prose message, then web search calls, then the JSON message: the JSON wins", () => {
  const body = {
    output: [
      msg(PROSE),
      { type: "web_search_call", status: "completed" },
      { type: "web_search_call", status: "completed" },
      msg(JSON.stringify(PLAN)),
    ],
  };
  const r = findResponseJson(body);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.json, PLAN);
});

test("output_text joins prose and JSON into one string: the JSON block is found", () => {
  const body = { output_text: `${PROSE}\n\n${JSON.stringify(PLAN)}`, output: [msg(PROSE), msg(JSON.stringify(PLAN))] };
  const r = findResponseJson(body);
  assert.deepEqual(r.ok && r.json, PLAN);
  const joinedOnly = findResponseJson({ output_text: `${PROSE}\n\n${JSON.stringify(PLAN)}` });
  assert.deepEqual(joinedOnly.ok && joinedOnly.json, PLAN);
});

test("a plain output_text JSON string still parses (no output array)", () => {
  const r = findResponseJson({ output_text: JSON.stringify(PLAN) });
  assert.deepEqual(r.ok && r.json, PLAN);
});

test("a fenced ```json answer parses", () => {
  const r = findResponseJson({ output: [msg("```json\n" + JSON.stringify(PLAN) + "\n```")] });
  assert.deepEqual(r.ok && r.json, PLAN);
});

test("brackets and braces inside strings don't break the block scan", () => {
  const tricky = { note: "use a {cover} [rated] \"heavy\" one", n: [1, 2] };
  const block = lastJsonBlock(`Here you go: ${JSON.stringify(tricky)} done.`);
  assert.deepEqual(block?.json, tricky);
});

test("two JSON blocks in prose: the last top-level one is kept, not a nested piece", () => {
  const first = { draft: true };
  const block = lastJsonBlock(`first ${JSON.stringify(first)} then ${JSON.stringify(PLAN)}`);
  assert.deepEqual(block?.json, PLAN);
});

test("prose only: not ok, and the last text comes back for the error message", () => {
  const r = findResponseJson({ output: [msg("Working on it."), msg(PROSE)] });
  assert.equal(r.ok, false);
  assert.equal(r.text, PROSE);
});

test("no text at all: not ok with null text", () => {
  assert.deepEqual(findResponseJson({ output: [{ type: "web_search_call" }] }), { ok: false, text: null });
  assert.deepEqual(findResponseJson({}), { ok: false, text: null });
});

test("a later message that is valid JSON wins over an earlier JSON message", () => {
  const r = findResponseJson({ output: [msg('{"partial":true}'), msg(JSON.stringify(PLAN))] });
  assert.deepEqual(r.ok && r.json, PLAN);
});

test("outputTextParts ignores non-text parts and junk items", () => {
  const parts = outputTextParts({
    output: [null, 3, { content: "x" }, { content: [{ type: "refusal", text: "no" }, { type: "output_text", text: "a" }, null] }, msg("b")],
  });
  assert.deepEqual(parts, ["a", "b"]);
});
