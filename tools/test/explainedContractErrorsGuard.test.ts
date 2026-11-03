/** formatExplainedContractErrors malformed-input guard (server log only,
 * planning step): the sibling diagnostic lines all stay quiet on malformed
 * input, and this one threw on a non-string warning entry (key() calls
 * .startsWith on it, so a number or null threw) instead of staying quiet.
 * Malformed warning sides now return null, the same quiet rule. Valid
 * inputs are unchanged. Pure, no network. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatExplainedContractErrors } from "@/lib/pipeline/runPlan";

type Errs = Parameters<typeof formatExplainedContractErrors>[0];
type Warnings = Parameters<typeof formatExplainedContractErrors>[1];

describe("formatExplainedContractErrors malformed-input guard", () => {
  test("a number warning entry stays quiet", () => {
    assert.equal(
      formatExplainedContractErrors(
        ["issues[1] missing frame"],
        [7] as unknown as Warnings,
      ),
      null,
    );
  });

  test("a null warning entry stays quiet", () => {
    assert.equal(
      formatExplainedContractErrors(
        ["issues[1] missing frame"],
        [null] as unknown as Warnings,
      ),
      null,
    );
  });

  test("an object warning entry stays quiet", () => {
    assert.equal(
      formatExplainedContractErrors(
        ["issues[1] missing frame"],
        [{}] as unknown as Warnings,
      ),
      null,
    );
  });

  test("a non-string warning alongside an explaining one stays quiet", () => {
    assert.equal(
      formatExplainedContractErrors(
        ["issues[1] missing frame"],
        ["issues[1] frame dropped in subset", 7] as unknown as Warnings,
      ),
      null,
    );
  });

  test("a valid explained error still logs", () => {
    assert.equal(
      formatExplainedContractErrors(
        ["issues[1] missing frame"],
        ["issues[1] frame dropped in subset"],
      ),
      "runPlan: plan kept with explained contract errors:\nissues[1] missing frame",
    );
  });

  test("an unexplained error still stays quiet", () => {
    assert.equal(
      formatExplainedContractErrors(
        ["issues[2] missing frame"],
        ["issues[1] frame dropped in subset"],
      ),
      null,
    );
  });

  test("empty errors still stay quiet", () => {
    assert.equal(formatExplainedContractErrors([], ["issues[1] note"]), null);
  });

  test("a non-array warnings side stays quiet", () => {
    assert.equal(
      formatExplainedContractErrors(
        ["issues[1] missing frame"],
        null as unknown as Warnings,
      ),
      null,
    );
  });

  test("a non-array errors side stays quiet", () => {
    assert.equal(
      formatExplainedContractErrors(
        null as unknown as Errs,
        ["issues[1] frame dropped in subset"],
      ),
      null,
    );
  });
});
