/** City + state before a real run (Antonio, 2026-10-30 4:22 PM): checks, device storage, and the request field. No network. */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkLocation,
  cleanCity,
  formatRegion,
  isValidCity,
  loadLocation,
  loadRegion,
  LOCATION_KEY,
  LOCATION_MESSAGES,
  saveLocation,
  US_STATES,
} from "@/lib/client/location";
import { createApiPlanJob, isResumeFailure, LOCATION_REQUIRED_MESSAGE, TESTER_CODE_MESSAGE } from "@/lib/client/apiPlanJob";
import { saveTestCode } from "@/lib/client/testCode";
import type { PlanJobStatus, PlanRequest } from "@/lib/types";
import { fakeWindow, noWindow } from "./browser-stubs";

afterEach(noWindow);

describe("city and state check", () => {
  test("both filled gives the 'City, ST' region the server's cost step reads", () => {
    const c = checkLocation({ city: "  Sebring ", state: "fl" });
    assert.deepEqual(c, { ok: true, region: "Sebring, FL", location: { city: "Sebring", state: "FL" } });
    assert.equal(formatRegion("St.  Petersburg", "fl"), "St. Petersburg, FL");
  });
  test("names which field is missing", () => {
    for (const [loc, missing] of [
      [{ city: "", state: "" }, "both"],
      [{ city: "", state: "FL" }, "city"],
      [{ city: "Sebring", state: "" }, "state"],
      [{ city: "Sebring", state: "ZZ" }, "state"],
      [{ city: "1", state: "FL" }, "city"],
    ] as const) {
      const c = checkLocation(loc);
      assert.equal(c.ok, false, JSON.stringify(loc));
      if (!c.ok) {
        assert.equal(c.missing, missing);
        assert.equal(c.message, LOCATION_MESSAGES[missing]);
      }
    }
    assert.equal(checkLocation(null).ok, false);
  });
  test("city rules: a letter, 2 to 60 characters, no comma", () => {
    assert.ok(isValidCity("Ft Myers"));
    assert.ok(isValidCity("Coeur d'Alene"));
    assert.ok(isValidCity("Peñasco"));
    assert.ok(!isValidCity("  "));
    assert.ok(!isValidCity("12"));
    assert.ok(!isValidCity("Sebring, FL"));
    assert.ok(!isValidCity("x".repeat(61)));
    assert.equal(cleanCity("  New   York "), "New York");
  });
  test("the picker lists the 50 states and DC, sorted by name", () => {
    assert.equal(US_STATES.length, 51);
    assert.ok(US_STATES.some((s) => s.code === "DC"));
    const names = US_STATES.map((s) => s.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("kept on this device", () => {
  test("saved under sightwork:location and read back", () => {
    const { store } = fakeWindow();
    saveLocation({ city: "Sebring", state: "FL" });
    assert.equal(store.get(LOCATION_KEY), JSON.stringify({ city: "Sebring", state: "FL" }));
    assert.deepEqual(loadLocation(), { city: "Sebring", state: "FL" });
    assert.equal(loadRegion(), "Sebring, FL");
  });
  test("half-filled is kept (nothing lost on reload) but is not a region; both blank clears it", () => {
    const { store } = fakeWindow();
    saveLocation({ city: "Sebring", state: "" });
    assert.deepEqual(loadLocation(), { city: "Sebring", state: "" });
    assert.equal(loadRegion(), "");
    saveLocation({ city: " ", state: "" });
    assert.equal(store.has(LOCATION_KEY), false);
  });
  test("bad saved data and no window read as blank, never throw", () => {
    const { store } = fakeWindow();
    store.set(LOCATION_KEY, "{not json");
    assert.deepEqual(loadLocation(), { city: "", state: "" });
    store.set(LOCATION_KEY, JSON.stringify({ city: 5, state: "QQ" }));
    assert.deepEqual(loadLocation(), { city: "", state: "" });
    noWindow();
    assert.deepEqual(loadLocation(), { city: "", state: "" });
  });
});

async function run(build: () => Promise<PlanRequest>) {
  const sent: { url: string; body: PlanRequest }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (u: string, init?: RequestInit) => {
    sent.push({ url: String(u), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ error: "stop here" }), { status: 500 });
  }) as typeof fetch;
  const statuses: PlanJobStatus[] = [];
  const realWarn = console.warn;
  console.warn = () => {};
  let builds = 0;
  try {
    await createApiPlanJob(async () => {
      builds += 1;
      return build();
    })({ file: {} as File, onStatus: (s) => statuses.push(s), signal: new AbortController().signal });
  } finally {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
  }
  return { sent, statuses, builds };
}

const req = (): PlanRequest => ({ durationSec: 30, frames: [{ tSec: 0, dataUrl: "data:image/jpeg;base64,AA==" }] });

describe("real run request", () => {
  test("the saved city and state go out as PlanRequest.region", async () => {
    fakeWindow();
    saveTestCode("tester");
    saveLocation({ city: "Sebring", state: "FL" });
    const { sent } = await run(async () => req());
    const plan = sent.find((s) => s.url.endsWith("/api/plan"));
    assert.equal(plan?.body.region, "Sebring, FL");
  });
  test("a builder-set region is kept", async () => {
    fakeWindow();
    saveTestCode("tester");
    saveLocation({ city: "Sebring", state: "FL" });
    const { sent } = await run(async () => ({ ...req(), region: "Austin, TX" }));
    assert.equal(sent.find((s) => s.url.endsWith("/api/plan"))?.body.region, "Austin, TX");
  });
  test("no city and state: stops before reading the video or sending anything, and the flow can reopen the card", async () => {
    fakeWindow();
    saveTestCode("tester");
    const { sent, statuses, builds } = await run(async () => req());
    assert.equal(builds, 0);
    assert.equal(sent.length, 0);
    const last = statuses.at(-1);
    assert.equal(last?.state, "failed");
    if (last?.state === "failed") assert.equal(last.message, LOCATION_REQUIRED_MESSAGE);
    assert.ok(isResumeFailure(LOCATION_REQUIRED_MESSAGE));
    assert.ok(isResumeFailure(TESTER_CODE_MESSAGE));
    assert.ok(!isResumeFailure("The plan took too long to finish."));
  });
});
