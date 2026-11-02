/** inlineSchemaRefs entry guard: a non-object schema used to pass
 * through silently (null in, null out), and a non-object $defs used
 * to throw a raw TypeError from the `in` check, with no field named.
 * Such inputs now throw a named reason error. Valid schemas are
 * unchanged: $ref inlining, $defs dropping, and anyOf passthrough
 * all behave exactly as before. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { inlineSchemaRefs } from "@/lib/pipeline/reason";

describe("inlineSchemaRefs entry guard", () => {
  test("a null schema throws a named reason error", () => {
    assert.throws(
      () => inlineSchemaRefs(null),
      /reason: inlineSchemaRefs schema must be an object/,
    );
  });

  test("a string schema throws a named reason error", () => {
    assert.throws(
      () => inlineSchemaRefs("not a schema"),
      /reason: inlineSchemaRefs schema must be an object/,
    );
  });

  test("an array schema throws a named reason error", () => {
    assert.throws(
      () => inlineSchemaRefs([]),
      /reason: inlineSchemaRefs schema must be an object/,
    );
  });

  test("a non-object $defs throws a named reason error", () => {
    assert.throws(
      () => inlineSchemaRefs({ $defs: "x", type: "object" }),
      /reason: inlineSchemaRefs schema\.\$defs must be an object/,
    );
    assert.throws(
      () => inlineSchemaRefs({ $defs: ["x"], type: "object" }),
      /reason: inlineSchemaRefs schema\.\$defs must be an object/,
    );
  });

  test("valid schemas inline, drop $defs, and pass anyOf through unchanged", () => {
    const schema = {
      $defs: { name: { type: "string" } },
      type: "object",
      properties: { title: { $ref: "#/$defs/name" } },
      anyOf: [{ type: "string" }, { type: "number" }],
    };
    assert.deepEqual(inlineSchemaRefs(schema), {
      type: "object",
      properties: { title: { type: "string" } },
      anyOf: [{ type: "string" }, { type: "number" }],
    });
    const plain = { type: "object", properties: { n: { type: "number" } } };
    assert.deepEqual(inlineSchemaRefs(plain), plain);
  });

  test("a $ref with a non-object $defs throws the named error, not a raw TypeError", () => {
    assert.throws(
      () => inlineSchemaRefs({ $ref: "#/$defs/name", $defs: "x" }),
      /reason: inlineSchemaRefs schema\.\$defs must be an object/,
    );
  });

  test("an unresolvable $ref still throws its existing named error", () => {
    assert.throws(
      () => inlineSchemaRefs({ $ref: "#/$defs/missing" }),
      /reason: cannot resolve schema \$ref "#\/\$defs\/missing"/,
    );
  });
});
