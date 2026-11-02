/** filterAndRenumber entry guard: a non-object output, a non-array
 * issues / materials / workOrder / saidVsSeen collection, or a
 * non-object entry in one of them used to throw a raw TypeError
 * reading .watch / .confidence / .forIssues / .fixes / .issueRank
 * off null, with no entry named. Such inputs now throw a named
 * reason error with the field and index. Valid outputs are
 * unchanged: the confidence filter, the demotion to watch, and the
 * rank remap still work. No network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { filterAndRenumber, type ReasonOutput } from "@/lib/pipeline/reason";

function output(over: Record<string, unknown>): ReasonOutput {
  return {
    spaceName: "Sanctuary stage",
    generatedFrom: "test",
    inventory: [],
    issues: [
      { rank: 1, confidence: 0.9, title: "Peeling paint", detail: "", frameIndex: 0, frameTimeSec: 0 },
      { rank: 2, confidence: 0.4, title: "Loose cable", detail: "", frameIndex: 1, frameTimeSec: 10 },
      { rank: 3, confidence: 0.2, title: "Dust", detail: "", frameIndex: 2, frameTimeSec: 20 },
    ],
    materials: [{ item: "Paint", forIssues: [1, 2, 3] }],
    workOrder: [{ order: 1, title: "Repaint", detail: "", fixes: [1, 3] }],
    transcriptSummary: null,
    saidVsSeen: [
      { issueRank: 1, said: "paint", seen: "peeling" },
      { issueRank: 3, said: "dust", seen: "dust" },
    ],
    heroFrameIndex: 0,
    ...over,
  } as unknown as ReasonOutput;
}

describe("filterAndRenumber entry guard", () => {
  test("a non-object output throws a named reason error", () => {
    assert.throws(
      () => filterAndRenumber(null as unknown as ReasonOutput),
      /reason: filterAndRenumber output must be an object/,
    );
    assert.throws(
      () => filterAndRenumber("nope" as unknown as ReasonOutput),
      /reason: filterAndRenumber output must be an object/,
    );
  });

  test("a non-array collection throws a named reason error", () => {
    assert.throws(
      () => filterAndRenumber(output({ issues: "nope" })),
      /reason: filterAndRenumber output\.issues must be an array/,
    );
    assert.throws(
      () => filterAndRenumber(output({ materials: null })),
      /reason: filterAndRenumber output\.materials must be an array/,
    );
    assert.throws(
      () => filterAndRenumber(output({ workOrder: undefined })),
      /reason: filterAndRenumber output\.workOrder must be an array/,
    );
    assert.throws(
      () => filterAndRenumber(output({ saidVsSeen: {} })),
      /reason: filterAndRenumber output\.saidVsSeen must be an array/,
    );
  });

  test("a non-object entry throws a named reason error with the index", () => {
    assert.throws(
      () => filterAndRenumber(output({ issues: [null] })),
      /reason: filterAndRenumber output\.issues\[0\] must be an object/,
    );
    assert.throws(
      () =>
        filterAndRenumber(
          output({
            issues: [
              { rank: 1, confidence: 0.9, title: "Peeling paint", detail: "", frameIndex: 0, frameTimeSec: 0 },
              "nope",
            ],
          }),
        ),
      /reason: filterAndRenumber output\.issues\[1\] must be an object/,
    );
    assert.throws(
      () => filterAndRenumber(output({ materials: [null] })),
      /reason: filterAndRenumber output\.materials\[0\] must be an object/,
    );
    assert.throws(
      () =>
        filterAndRenumber(
          output({
            workOrder: [
              { order: 1, title: "Repaint", detail: "", fixes: [1] },
              undefined,
            ],
          }),
        ),
      /reason: filterAndRenumber output\.workOrder\[1\] must be an object/,
    );
    assert.throws(
      () => filterAndRenumber(output({ saidVsSeen: [null] })),
      /reason: filterAndRenumber output\.saidVsSeen\[0\] must be an object/,
    );
  });

  test("a valid output still filters, demotes, and remaps", () => {
    const filtered = filterAndRenumber(output({}));
    assert.deepEqual(filtered.issues, [
      { rank: 1, confidence: 0.9, title: "Peeling paint", detail: "", frameIndex: 0, frameTimeSec: 0 },
    ]);
    assert.deepEqual(filtered.watch, [
      { title: "Loose cable", detail: "", frameIndex: 1, frameTimeSec: 10, confidence: 0.4 },
    ]);
    assert.deepEqual(filtered.materials, [{ item: "Paint", forIssues: [1] }]);
    assert.deepEqual(filtered.workOrder, [
      { order: 1, title: "Repaint", detail: "", fixes: [1] },
    ]);
    assert.deepEqual(filtered.saidVsSeen, [
      { issueRank: 1, said: "paint", seen: "peeling" },
    ]);
    assert.equal(filtered.coverageNote, undefined);
  });
});
