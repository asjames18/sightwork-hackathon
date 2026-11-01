/**
 * formatExplainedContractErrors (server log only, planning step): reports the contract errors a
 * run kept because a reason warning already explains them, so a real run says which contract
 * failures a kept-with-warnings plan shipped with — the draft comment says those errors are
 * "logged, not thrown", but until now no line logged them. Pure, no network, no plan output.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatExplainedContractErrors } from "@/lib/pipeline/runPlan";

describe("formatExplainedContractErrors", () => {
  test("passing check stays quiet", () => {
    assert.equal(formatExplainedContractErrors([], []), null);
  });

  test("all explained errors are reported", () => {
    assert.equal(
      formatExplainedContractErrors(
        ["issues[2] must have at least one proof frame"],
        ["issues[2] has no proof frames in the sampled frames"],
      ),
      "runPlan: plan kept with explained contract errors:\nissues[2] must have at least one proof frame",
    );
  });

  test("partly explained stays quiet (the unexplained path throws instead)", () => {
    assert.equal(
      formatExplainedContractErrors(
        [
          "issues[2] must have at least one proof frame",
          "heroFrameIndex must be a frame in the plan",
        ],
        ["issues[2] has no proof frames in the sampled frames"],
      ),
      null,
    );
  });

  test("none explained stays quiet", () => {
    assert.equal(
      formatExplainedContractErrors(
        ["heroFrameIndex must be a frame in the plan"],
        ["issues[2] has no proof frames in the sampled frames"],
      ),
      null,
    );
  });

  test("no warnings with errors stays quiet", () => {
    assert.equal(
      formatExplainedContractErrors(["issues[2] must have at least one proof frame"], []),
      null,
    );
  });

  test("malformed inputs stay quiet", () => {
    assert.equal(
      formatExplainedContractErrors(null as unknown as string[], []),
      null,
    );
    assert.equal(
      formatExplainedContractErrors(["issues[2] must have at least one proof frame"], null as unknown as string[]),
      null,
    );
    assert.equal(
      formatExplainedContractErrors([123 as unknown as string], ["issues[2] has no proof frames"]),
      null,
    );
  });
});
