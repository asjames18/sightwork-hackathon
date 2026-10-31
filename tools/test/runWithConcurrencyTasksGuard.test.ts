/** runWithConcurrency tasks guard: a non-array tasks or a non-function entry throws a named segment: error before any worker starts, instead of a raw TypeError from inside the pool. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { runWithConcurrency } from "@/lib/pipeline/segment";

describe("runWithConcurrency tasks guard", () => {
  test("non-array tasks throws a named error", async () => {
    await assert.rejects(
      // @ts-expect-error testing a bad caller
      runWithConcurrency(null, 2),
      /segment: tasks must be an array of functions, got null/,
    );
    await assert.rejects(
      // @ts-expect-error testing a bad caller
      runWithConcurrency("nope", 2),
      /segment: tasks must be an array of functions, got string/,
    );
  });

  test("non-function entry throws a named error naming the index", async () => {
    await assert.rejects(
      // @ts-expect-error testing a bad caller
      runWithConcurrency([async () => 1, 42], 2),
      /segment: task 1 must be a function, got number/,
    );
  });

  test("valid tasks still run in task order, and an empty list returns []", async () => {
    const order: number[] = [];
    const results = await runWithConcurrency(
      [1, 2, 3].map(
        (n) => async () => {
          order.push(n);
          return n * 10;
        },
      ),
      2,
    );
    assert.deepEqual(results, [10, 20, 30]);
    assert.deepEqual(await runWithConcurrency([], 2), []);
  });
});
