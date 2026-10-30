/**
 * Pins the rules OpenAI-style strict structured output enforces, so a
 * schema sent to the Meta Responses API with strict: true can't be
 * refused with a 400 before any work runs (the Oct 30 cost step lost
 * its range that way: unitCosts[].sourceIndex was optional).
 *
 * Strict mode needs, on every object: additionalProperties false and
 * a `required` array that lists every key in `properties`. An optional
 * field is written as required with a null-able type instead.
 *
 * COST_SCHEMA is the schema sent with strict: true (Meta provider).
 * REASON_SCHEMA and REVIEW_SCHEMA go to Baseten, where the schema is
 * only appended to the prompt, so they are not checked here.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { COST_SCHEMA } from "@/lib/pipeline/planPrompts";

/** Every strict-mode problem in a schema, as "path: problem" lines. */
function strictProblems(schema: unknown, path = "$"): string[] {
  const out: string[] = [];
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return out;
  const s = schema as Record<string, unknown>;
  for (const k of ["$ref", "anyOf", "oneOf", "allOf"]) {
    if (k in s) out.push(`${path}: uses ${k}`);
  }
  const props = s.properties as Record<string, unknown> | undefined;
  const isObject = s.type === "object" || (Array.isArray(s.type) && s.type.includes("object")) || !!props;
  if (isObject) {
    if (s.additionalProperties !== false) out.push(`${path}: additionalProperties is not false`);
    const keys = Object.keys(props ?? {});
    const required = Array.isArray(s.required) ? (s.required as string[]) : null;
    if (!required) out.push(`${path}: no required array`);
    else {
      for (const key of keys) if (!required.includes(key)) out.push(`${path}.${key}: not in required`);
      for (const key of required) if (!keys.includes(key)) out.push(`${path}: required lists unknown key ${key}`);
    }
    for (const key of keys) out.push(...strictProblems(props![key], `${path}.${key}`));
  }
  if (s.items !== undefined) out.push(...strictProblems(s.items, `${path}[]`));
  return out;
}

describe("strictProblems (the checker itself)", () => {
  test("a fully strict object passes", () => {
    assert.deepEqual(
      strictProblems({
        type: "object",
        additionalProperties: false,
        required: ["a", "b"],
        properties: { a: { type: "string" }, b: { type: ["integer", "null"] } },
      }),
      [],
    );
  });
  test("flags an optional key, open objects and nested arrays of objects", () => {
    const problems = strictProblems({
      type: "object",
      additionalProperties: false,
      required: ["list"],
      properties: {
        list: {
          type: "array",
          items: { type: "object", required: ["x"], properties: { x: { type: "number" }, y: { type: "number" } } },
        },
      },
    });
    assert.deepEqual(problems, ["$.list[]: additionalProperties is not false", "$.list[].y: not in required"]);
  });
  test("flags anyOf and a missing required array", () => {
    assert.deepEqual(strictProblems({ type: "object", additionalProperties: false, properties: { a: { anyOf: [] } } }), [
      "$: no required array",
      "$.a: uses anyOf",
    ]);
  });
});

describe("schemas sent with strict: true", () => {
  const costProblems = strictProblems(COST_SCHEMA);
  const onlyKnown = costProblems.every((p) => p === "$.unitCosts[].sourceIndex: not in required");
  test("COST_SCHEMA has no strict-mode problems (Meta refuses it with a 400 otherwise)", () => {
    assert.deepEqual(costProblems, []);
  });
  test("COST_SCHEMA has no problems beyond the one known open item", () => {
    assert.ok(onlyKnown, costProblems.join("\n"));
  });
});
