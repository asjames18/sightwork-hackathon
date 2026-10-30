/**
 * Own-video runner choice: a video the user recorded or chose must never end on the example plan unless
 * an example-plan preview was asked for on purpose. Offline: no network, no model calls.
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ownVideoRunnerKind, needsTesterCode, planJobFor, pickRunnerKind } from "@/lib/client/selectRunner";
import { mockPlanJob } from "@/lib/client/planJob";
import { messageForStatus, TESTER_CODE_MESSAGE, WRONG_CODE_MESSAGE, isTesterCodeFailure, createApiPlanJob } from "@/lib/client/apiPlanJob";
import { EXAMPLES } from "@/lib/examples";
import type { PlanJobStatus } from "@/lib/types";
import { fakeWindow, noWindow } from "./browser-stubs";

afterEach(noWindow);

const recorded = { name: "sightwork-walkthrough.webm", type: "video/webm", size: 1 } as File;
const chosen = { name: "IMG_0412.MOV", type: "video/quicktime", size: 1 } as File;

describe("own video runner", () => {
  test("public site (env unset), plain /start: a real run, not the example plan", () => {
    assert.equal(ownVideoRunnerKind(null, undefined), "api");
    assert.equal(ownVideoRunnerKind("", undefined), "api");
    assert.equal(ownVideoRunnerKind("", ""), "api");
    // The upload screen's own mode still reads mock here: the tester code form isn't shown up front.
    assert.equal(pickRunnerKind("", undefined), "mock");
  });
  test("unrelated query keys don't switch on the preview", () => {
    assert.equal(ownVideoRunnerKind("?view=last", undefined), "api");
    assert.equal(ownVideoRunnerKind("?utm_source=x&plan=baseten", undefined), "api");
  });
  test("?runner wins over everything", () => {
    assert.equal(ownVideoRunnerKind("?runner=api", "mock"), "api");
    assert.equal(ownVideoRunnerKind("?runner=api&fail=planning", undefined), "api");
    assert.equal(ownVideoRunnerKind("?runner=mock", undefined), "mock");
    assert.equal(ownVideoRunnerKind("?runner=mock", "api"), "mock");
  });
  test("the example preview only when asked for: ?fail=, ?mock=, or an explicit mock build", () => {
    assert.equal(ownVideoRunnerKind("?fail=planning", undefined), "mock");
    assert.equal(ownVideoRunnerKind("?mock=nometa", undefined), "mock");
    assert.equal(ownVideoRunnerKind("", "mock"), "mock");
    assert.equal(ownVideoRunnerKind("", " Mock "), "mock");
    assert.equal(ownVideoRunnerKind("", "api"), "api");
    assert.equal(ownVideoRunnerKind("?runner=nope", "nope"), "api");
  });
  test("a real run without a saved code asks for it first; the preview never does", () => {
    assert.equal(needsTesterCode("api", ""), true);
    assert.equal(needsTesterCode("api", "   "), true);
    assert.equal(needsTesterCode("api", "abc"), false);
    assert.equal(needsTesterCode("mock", ""), false);
  });
  test("runners are stable per kind, so a run only restarts on a new video or retry", () => {
    assert.equal(planJobFor("mock"), mockPlanJob);
    assert.equal(planJobFor("api"), planJobFor("api"));
    assert.notEqual(planJobFor("api"), mockPlanJob);
  });
  test("the 401 text is the one the flow matches to reopen the code prompt", () => {
    assert.equal(messageForStatus(401), TESTER_CODE_MESSAGE);
    assert.match(TESTER_CODE_MESSAGE, /tester code/);
    assert.ok(isTesterCodeFailure(TESTER_CODE_MESSAGE));
    assert.ok(isTesterCodeFailure(WRONG_CODE_MESSAGE));
    assert.ok(!isTesterCodeFailure("The plan took too long to finish."));
  });
  test("a saved code the server refuses says so plainly, not a generic failure", async () => {
    fakeWindow("?runner=api");
    window.localStorage.setItem("sightwork:test-code", "not-the-code");
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "x" }), { status: 401 })) as typeof fetch;
    try {
      const statuses: PlanJobStatus[] = [];
      const req = { frames: [], audio: null } as unknown as import("@/lib/types").PlanRequest;
      await createApiPlanJob(async () => req)({ file: chosen, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
      const last = statuses.at(-1);
      assert.equal(last?.state, "failed");
      if (last?.state === "failed") assert.equal(last.message, WRONG_CODE_MESSAGE);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("why the bug happened: the preview runner ignores the video", () => {
  // Recorded and chosen videos both reach the runner the same way (UploadStep's pick, then the card's button),
  // and the preview runner never reads the file: it always ends on an example plan.
  for (const [label, file] of [["recorded", recorded], ["chosen", chosen]] as const) {
    test(`${label} video through the preview runner ends on an example plan`, async () => {
      fakeWindow("?runner=mock");
      const statuses: PlanJobStatus[] = [];
      // A real timer walk is ~5 s; abort-free, just wait for the end.
      await mockPlanJob({ file, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
      const last = statuses.at(-1);
      assert.equal(last?.state, "done");
      if (last?.state === "done") assert.ok(EXAMPLES.some((e) => e.plan.spaceName === last.plan.spaceName && e.plan.generatedFrom === last.plan.generatedFrom));
    });
  }
  for (const [label, file] of [["recorded", recorded], ["chosen", chosen]] as const) {
    test(`${label} video on the public site goes to the real runner; with no code it stops at once with the code message`, async () => {
      fakeWindow("");
      const kind = ownVideoRunnerKind("", undefined);
      assert.equal(kind, "api");
      const calls: string[] = [];
      const realFetch = globalThis.fetch;
      globalThis.fetch = (async (u: string) => {
        calls.push(String(u));
        throw new Error("no network in tests");
      }) as typeof fetch;
      try {
        const statuses: PlanJobStatus[] = [];
        await planJobFor(kind)({ file, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
        const last = statuses.at(-1);
        assert.equal(last?.state, "failed");
        if (last?.state === "failed") assert.equal(last.message, TESTER_CODE_MESSAGE);
        assert.ok(!statuses.some((s) => s.state === "done"), "never an example plan");
        assert.deepEqual(calls, [], "nothing sent without a code");
      } finally {
        globalThis.fetch = realFetch;
      }
    });
  }
});
