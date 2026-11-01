/**
 * formatReviewVerdicts (server log only, reviewing step): reports when the reviewer leaves an
 * issue unverified or without a verdict, and when the reviewing step did not run, so a real run
 * shows at a glance whether reviewing backed the plan. Pure, no network, no plan output.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatReviewVerdicts } from "@/lib/pipeline/runPlan";

const verdict = (problemId: string, verified: boolean) => ({ problemId, verified });

describe("formatReviewVerdicts", () => {
  test("all issues verified stays quiet", () => {
    assert.equal(
      formatReviewVerdicts(
        { ran: true, items: [verdict("1", true), verdict("2", true)] },
        [1, 2],
      ),
      null,
    );
  });

  test("unverified issues are named by rank", () => {
    assert.equal(
      formatReviewVerdicts(
        {
          ran: true,
          items: [verdict("1", true), verdict("2", false), verdict("3", false)],
        },
        [1, 2, 3],
      ),
      "runPlan: review: 1/3 issues verified, not verified: 2, 3",
    );
  });

  test("issues with no verdict are named by rank", () => {
    assert.equal(
      formatReviewVerdicts({ ran: true, items: [verdict("1", true)] }, [1, 2]),
      "runPlan: review: 1/2 issues verified, no verdict: 2",
    );
  });

  test("review that did not run is named with the issue count", () => {
    assert.equal(
      formatReviewVerdicts({ ran: false, items: [] }, [1, 2]),
      "runPlan: review: did not run for 2 issues",
    );
  });

  test("no issues stays quiet whether the review ran or not", () => {
    assert.equal(formatReviewVerdicts({ ran: true, items: [] }, []), null);
    assert.equal(formatReviewVerdicts({ ran: false, items: [] }, []), null);
  });

  test("stray and malformed verdicts are ignored", () => {
    assert.equal(
      formatReviewVerdicts(
        { ran: true, items: [verdict("9", true), verdict("x", true)] },
        [1],
      ),
      "runPlan: review: 0/1 issues verified, no verdict: 1",
    );
  });

  test("first verdict per rank wins", () => {
    assert.equal(
      formatReviewVerdicts(
        { ran: true, items: [verdict("2", false), verdict("2", true)] },
        [2],
      ),
      "runPlan: review: 0/1 issues verified, not verified: 2",
    );
  });
});
