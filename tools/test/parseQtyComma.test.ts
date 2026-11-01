/**
 * parseQty reads thousands commas as digits, so a bulk material qty
 * like "1,000 sq ft" prices as a thousand instead of as one.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseQty } from "@/lib/pipeline/cost";

describe("parseQty thousands commas", () => {
  test("reads 1,000 sq ft as 1000", () => {
    assert.equal(parseQty("1,000 sq ft"), 1000);
  });

  test("reads 1,000,000 screws as 1000000", () => {
    assert.equal(parseQty("1,000,000 screws"), 1000000);
  });

  test("reads 1,000.5 sq ft as 1000.5", () => {
    assert.equal(parseQty("1,000.5 sq ft"), 1000.5);
  });

  test("keeps a plain leading number", () => {
    assert.equal(parseQty("12 chairs"), 12);
  });

  test("keeps no leading number as 1", () => {
    assert.equal(parseQty("a roll"), 1);
  });

  test("leaves a malformed comma group unchanged", () => {
    assert.equal(parseQty("12,34 widgets"), 12);
  });
});
