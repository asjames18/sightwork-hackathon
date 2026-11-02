/** dropTotalInventoryRows entry guard: a non-array inventory, a
 * non-object entry, or an entry with a non-string label or a
 * non-finite count used to throw a raw TypeError reading .label /
 * .count / .replace off null, with no entry named. Such inputs now
 * throw a named reason error with the index and field. Valid
 * inventories are unchanged: a total row whose count equals the
 * zone-row sum is still dropped, and a mismatched total row is
 * still kept. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dropTotalInventoryRows } from "@/lib/pipeline/reason";
import type { InventoryItem } from "@/lib/types";

function row(label: string, count: number): InventoryItem {
  return { label, count, confidence: 1 };
}

describe("dropTotalInventoryRows entry guard", () => {
  test("a non-array inventory throws a named reason error", () => {
    assert.throws(
      () => dropTotalInventoryRows(null as unknown as InventoryItem[]),
      /reason: dropTotalInventoryRows inventory must be an array/,
    );
    assert.throws(
      () => dropTotalInventoryRows({} as unknown as InventoryItem[]),
      /reason: dropTotalInventoryRows inventory must be an array/,
    );
  });

  test("a non-object entry throws a named reason error with the index", () => {
    assert.throws(
      () => dropTotalInventoryRows([row("Chairs", 2), null as unknown as InventoryItem]),
      /reason: dropTotalInventoryRows inventory\[1\] must be an object/,
    );
    assert.throws(
      () => dropTotalInventoryRows(["nope" as unknown as InventoryItem]),
      /reason: dropTotalInventoryRows inventory\[0\] must be an object/,
    );
  });

  test("a non-string label throws a named reason error with the index", () => {
    assert.throws(
      () =>
        dropTotalInventoryRows([
          row("Chairs", 2),
          { label: 3, count: 2, confidence: 1 } as unknown as InventoryItem,
        ]),
      /reason: dropTotalInventoryRows inventory\[1\]\.label must be a string/,
    );
  });

  test("a non-finite count throws a named reason error with the index", () => {
    assert.throws(
      () => dropTotalInventoryRows([{ label: "Chairs", count: NaN, confidence: 1 }]),
      /reason: dropTotalInventoryRows inventory\[0\]\.count must be a finite number/,
    );
    assert.throws(
      () => dropTotalInventoryRows([{ label: "Chairs", count: "2", confidence: 1 } as unknown as InventoryItem]),
      /reason: dropTotalInventoryRows inventory\[0\]\.count must be a finite number/,
    );
  });

  test("a valid inventory still drops a matching total row and keeps a mismatched one", () => {
    assert.deepEqual(
      dropTotalInventoryRows([
        row("Chairs (north)", 2),
        row("Chairs (south)", 3),
        row("Chairs (total)", 5),
      ]),
      [row("Chairs (north)", 2), row("Chairs (south)", 3)],
    );
    assert.deepEqual(
      dropTotalInventoryRows([
        row("Chairs (north)", 2),
        row("Chairs (total)", 9),
      ]),
      [row("Chairs (north)", 2), row("Chairs (total)", 9)],
    );
  });
});
