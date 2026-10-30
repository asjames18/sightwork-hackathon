/** Client helpers behind the upload and processing screens: pure logic, no network, no model calls. */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { checkDuration, formatDuration } from "@/lib/client/duration";
import { pickRunnerKind } from "@/lib/client/selectRunner";
import { requestBudgetBytes, MIN_REQUEST_BYTES, MAX_REQUEST_BYTES, BuildRequestError } from "@/lib/client/buildPlanRequest";
import { BLANK_TAKE_MESSAGE } from "@/lib/client/blankTake";
import { parseStatusLine, messageForStatus, createApiPlanJob } from "@/lib/client/apiPlanJob";
import { loadTestCode, saveTestCode, TEST_CODE_HEADER } from "@/lib/client/testCode";
import { loadLastPlan, saveLastPlan } from "@/lib/client/lastPlan";
import { pickMockKind } from "@/lib/mock/pickMockPlan";
import { FEATURED_EXAMPLE } from "@/lib/examples";
import type { PlanJobStatus, PlanRequest } from "@/lib/types";
import { fakeWindow, noWindow } from "./browser-stubs";

afterEach(noWindow);

describe("video length check", () => {
  test("blocks unreadable, too short and too long clips", () => {
    for (const d of [NaN, 0, -1, Infinity]) assert.equal(checkDuration(d).kind, "block");
    assert.equal(checkDuration(4.9).kind, "block");
    assert.equal(checkDuration(150.1).kind, "block");
  });
  test("warns past 95 s, ok from 5 to 95 s", () => {
    assert.deepEqual(checkDuration(5), { kind: "ok", durationSec: 5 });
    assert.deepEqual(checkDuration(95), { kind: "ok", durationSec: 95 });
    assert.equal(checkDuration(95.5).kind, "warn");
    assert.equal(checkDuration(150).kind, "warn");
  });
  test("formats m:ss", () => {
    assert.equal(formatDuration(0), "0:00");
    assert.equal(formatDuration(44.4), "0:44");
    assert.equal(formatDuration(89.6), "1:30");
    assert.equal(formatDuration(-3), "0:00");
  });
});

describe("runner choice", () => {
  test("query wins, env is the default, mock otherwise", () => {
    assert.equal(pickRunnerKind(null, undefined), "mock");
    assert.equal(pickRunnerKind("", "api"), "api");
    assert.equal(pickRunnerKind("?runner=mock", "api"), "mock");
    assert.equal(pickRunnerKind("?runner=api", undefined), "api");
    assert.equal(pickRunnerKind("?runner=baseten", "nope"), "mock");
  });
  test("mock plan kind", () => {
    assert.equal(pickMockKind(null), "featured");
    assert.equal(pickMockKind("?mock=nometa"), "nometa");
    assert.equal(pickMockKind("?mock=nocost"), "nocost");
    assert.equal(pickMockKind("?mock=full"), "full");
    assert.equal(pickMockKind("?mock=other"), "featured");
  });
});

describe("streamed status lines", () => {
  test("keeps valid lines and drops the rest", () => {
    assert.deepEqual(parseStatusLine('{"state":"running","step":"listening"}'), { state: "running", step: "listening" });
    assert.deepEqual(parseStatusLine('{"state":"running","step":"comparing","skipped":["looking","bogus"]}'), {
      state: "running",
      step: "comparing",
      skipped: ["looking"],
    });
    assert.equal(parseStatusLine(""), null);
    assert.equal(parseStatusLine("not json"), null);
    assert.equal(parseStatusLine('{"state":"running","step":"done"}'), null);
    assert.equal(parseStatusLine('{"state":"done"}'), null);
    const failed = parseStatusLine('{"state":"failed","step":"planning"}');
    assert.equal(failed?.state, "failed");
    assert.ok(failed?.state === "failed" && failed.message.length > 0, "falls back to a friendly message");
  });
  test("HTTP errors become plain sentences", () => {
    assert.match(messageForStatus(401), /tester code/);
    assert.match(messageForStatus(413), /too large/);
    assert.match(messageForStatus(500), /Something went wrong/);
  });
});

describe("tester code and last plan storage", () => {
  test("tester code is trimmed, cleared when blank, empty without a window", () => {
    assert.equal(loadTestCode(), "");
    fakeWindow();
    saveTestCode("  abc  ");
    assert.equal(loadTestCode(), "abc");
    saveTestCode("   ");
    assert.equal(loadTestCode(), "");
  });
  test("last plan round-trips and rejects junk", () => {
    const { store } = fakeWindow();
    assert.equal(loadLastPlan(), null);
    assert.ok(saveLastPlan(FEATURED_EXAMPLE.plan, "walk.mov"));
    assert.equal(loadLastPlan()?.videoName, "walk.mov");
    assert.equal(loadLastPlan()?.plan.spaceName, FEATURED_EXAMPLE.plan.spaceName);
    store.set("sightwork:lastPlan:v1", '{"plan":{}}');
    assert.equal(loadLastPlan(), null);
    store.set("sightwork:lastPlan:v1", "{oops");
    assert.equal(loadLastPlan(), null);
  });
});

/** Runs the real API runner against a fake fetch that streams `chunks` (or answers with `status`). */
async function runApi(opts: { chunks?: string[]; status?: number; throws?: boolean; code?: string }) {
  const w = fakeWindow();
  if (opts.code) saveTestCode(opts.code);
  const sent: { headers?: Record<string, string>; body?: string } = {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.headers = init.headers as Record<string, string>;
    sent.body = init.body as string;
    if (opts.throws) throw new TypeError("network down");
    if (opts.status && opts.status !== 200) return new Response(JSON.stringify({ error: "dev detail" }), { status: opts.status });
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(c) {
        for (const ch of opts.chunks ?? []) c.enqueue(enc.encode(ch));
        c.close();
      },
    });
    return new Response(stream, { status: 200 });
  }) as typeof fetch;
  const statuses: PlanJobStatus[] = [];
  const request: PlanRequest = { durationSec: 30, frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,AA==" }] };
  const realWarn = console.warn;
  console.warn = () => {};
  try {
    await createApiPlanJob(async () => request)({ file: {} as File, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
  }
  void w;
  return { statuses, sent };
}

describe("API runner (fake fetch, nothing leaves the machine)", () => {
  test("sends the tester code header and reads NDJSON split across chunks", async () => {
    const plan = { spaceName: "Test room", issues: [] };
    const { statuses, sent } = await runApi({
      code: "tester-1",
      chunks: ['{"state":"running","step":"listen', 'ing"}\n{"state":"running","step":"comparing"}\n', `{"state":"done","plan":${JSON.stringify(plan)}}`],
    });
    assert.equal(sent.headers?.[TEST_CODE_HEADER], "tester-1");
    assert.equal(JSON.parse(sent.body ?? "{}").durationSec, 30);
    assert.deepEqual(
      statuses.map((s) => (s.state === "running" ? s.step : s.state)),
      ["uploading", "listening", "comparing", "done"],
    );
  });
  test("no tester code saved: fails at once, nothing is uploaded", async () => {
    const { statuses, sent } = await runApi({ chunks: ['{"state":"done","plan":{"issues":[]}}'] });
    assert.equal(sent.body, undefined, "no request sent");
    const last = statuses.at(-1);
    assert.ok(last?.state === "failed" && /tester code/.test(last.message) && last.step === "uploading");
  });
  test("401 (wrong code) shows the tester-code sentence on the step it was on", async () => {
    const { statuses } = await runApi({ status: 401, code: "wrong" });
    const last = statuses.at(-1);
    assert.ok(last?.state === "failed" && /tester code/.test(last.message) && last.step === "uploading");
  });
  test("a stream that ends without done is a dropped connection", async () => {
    const { statuses } = await runApi({ code: "c", chunks: ['{"state":"running","step":"planning"}\n'] });
    const last = statuses.at(-1);
    assert.ok(last?.state === "failed" && /connection dropped/.test(last.message) && last.step === "planning");
  });
  test("a network error fails cleanly", async () => {
    const { statuses, sent } = await runApi({ throws: true, code: "c" });
    assert.ok(sent.body, "request was attempted");
    assert.equal(statuses.at(-1)?.state, "failed");
  });
  test("nothing after the final line is shown", async () => {
    const { statuses } = await runApi({ code: "c", chunks: ['{"state":"failed","step":"looking","message":"x"}\n{"state":"running","step":"planning"}\n'] });
    assert.deepEqual(statuses.map((s) => s.state), ["running", "failed"]);
  });
});

describe("transcribe split (fake fetch, nothing leaves the machine)", () => {
  type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
  async function runSplit(transcribe: { status?: number; json?: unknown; throws?: boolean }, request?: Partial<PlanRequest>) {
    fakeWindow();
    saveTestCode("tester-2");
    const calls: Call[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
      if (url === "/api/transcribe") {
        if (transcribe.throws) throw new TypeError("network down");
        return new Response(JSON.stringify(transcribe.json ?? { error: "x" }), { status: transcribe.status ?? 200 });
      }
      return new Response('{"state":"done","plan":{"issues":[]}}\n', { status: 200 });
    }) as typeof fetch;
    const statuses: PlanJobStatus[] = [];
    const req: PlanRequest = {
      durationSec: 40,
      spaceType: "room",
      frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,AA==" }],
      audioWavBase64: "UklGRg==",
      ...request,
    };
    const realWarn = console.warn;
    console.warn = () => {};
    try {
      await createApiPlanJob(async () => req)({ file: {} as File, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
    } finally {
      globalThis.fetch = realFetch;
      console.warn = realWarn;
    }
    return { calls, statuses };
  }

  test("narration goes to /api/transcribe first; the plan request carries the transcript, not the WAV", async () => {
    const turns = [{ startSec: 1.2, text: "the steps have no handrail" }];
    const { calls, statuses } = await runSplit({ json: { transcript: "[1.2] the steps have no handrail", transcriptTurns: turns } });
    assert.deepEqual(calls.map((c) => c.url), ["/api/transcribe", "/api/plan"]);
    assert.equal(calls[0].headers[TEST_CODE_HEADER], "tester-2");
    assert.deepEqual(calls[0].body, { audioWavBase64: "UklGRg==", spaceType: "room" });
    assert.equal(calls[1].body.audioWavBase64, undefined);
    assert.equal(calls[1].body.transcript, "[1.2] the steps have no handrail");
    assert.deepEqual(calls[1].body.transcriptTurns, turns);
    assert.equal(statuses.at(-1)?.state, "done");
  });
  test("no speech: null transcript and empty turns are sent together", async () => {
    const { calls } = await runSplit({ json: { transcript: "  ", transcriptTurns: [] } });
    assert.equal(calls[1].body.transcript, null);
    assert.deepEqual(calls[1].body.transcriptTurns, []);
    assert.equal(calls[1].body.audioWavBase64, undefined);
  });
  test("transcribe 500, a bad body, or a network error keeps the old WAV request", async () => {
    for (const t of [{ status: 500 }, { json: { transcript: 3 } }, { json: { transcript: "x", transcriptTurns: [{ startSec: "a" }] } }, { throws: true }]) {
      const { calls, statuses } = await runSplit(t);
      assert.equal(calls.at(-1)?.url, "/api/plan");
      assert.equal(calls.at(-1)?.body.audioWavBase64, "UklGRg==");
      assert.equal(calls.at(-1)?.body.transcript, undefined);
      assert.equal(statuses.at(-1)?.state, "done");
    }
  });
  test("transcribe 401 stops with the tester-code sentence and no plan request", async () => {
    const { calls, statuses } = await runSplit({ status: 401 });
    assert.deepEqual(calls.map((c) => c.url), ["/api/transcribe"]);
    const last = statuses.at(-1);
    assert.ok(last?.state === "failed" && /tester code/.test(last.message));
  });
  test("no narration: no transcribe call", async () => {
    const { calls } = await runSplit({}, { audioWavBase64: undefined });
    assert.deepEqual(calls.map((c) => c.url), ["/api/plan"]);
  });
});

describe("request budget setting", () => {
  const DEFAULT = 9 * 1024 * 1024;
  test("blank, junk and out-of-range values keep the 9 MB default", () => {
    for (const raw of [undefined, "", "  ", "abc", "4.5e6", "4300000.5", "-4300000", "0", "1048575", "9437185", "99999999999"])
      assert.equal(requestBudgetBytes(raw), DEFAULT, String(raw));
  });
  test("whole numbers from 1 MB to 9 MB are used as given", () => {
    assert.equal(requestBudgetBytes("4300000"), 4_300_000);
    assert.equal(requestBudgetBytes(" 4300000 "), 4_300_000);
    assert.equal(requestBudgetBytes(String(MIN_REQUEST_BYTES)), MIN_REQUEST_BYTES);
    assert.equal(requestBudgetBytes(String(MAX_REQUEST_BYTES)), MAX_REQUEST_BYTES);
    assert.equal(MAX_REQUEST_BYTES, DEFAULT);
  });
  test("a Vercel-sized budget stays under the 4.5 MB platform cap with room for JSON", () => {
    assert.ok(requestBudgetBytes("4300000") + 64 * 1024 < 4.5 * 1024 * 1024);
  });
});

describe("API runner: a video problem found on the device", () => {
  async function runBuildFail(err: unknown) {
    fakeWindow();
    saveTestCode("tester-3");
    const realFetch = globalThis.fetch;
    let fetches = 0;
    globalThis.fetch = (async () => {
      fetches++;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const statuses: PlanJobStatus[] = [];
    try {
      await createApiPlanJob(async () => {
        throw err;
      })({ file: {} as File, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
    } finally {
      globalThis.fetch = realFetch;
    }
    const last = statuses[statuses.length - 1];
    return { fetches, message: last?.state === "failed" ? last.message : undefined };
  }

  test("shows the specific message (too long, blank take) and makes no upload", async () => {
    const tooLong = "That video is too long to send. Try a walkthrough of 90 seconds or less.";
    for (const msg of [tooLong, BLANK_TAKE_MESSAGE]) {
      const { fetches, message } = await runBuildFail(new BuildRequestError(msg));
      assert.equal(message, msg);
      assert.equal(fetches, 0);
    }
  });

  test("any other failure keeps the generic read message", async () => {
    const { fetches, message } = await runBuildFail(new Error("decoder exploded: internal detail"));
    assert.match(message ?? "", /^We couldn't read that video/);
    assert.doesNotMatch(message ?? "", /internal detail/);
    assert.equal(fetches, 0);
  });
});
