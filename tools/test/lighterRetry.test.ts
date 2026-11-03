/** After a run that ran out of time, the retry goes lighter: its own runner, with fewer and smaller frames. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isTimeLimitFailure, TIME_LIMIT_FAIL } from "@/lib/client/apiPlanJob";
import { LIGHT_LONG_SIDE, LIGHT_MAX_FRAMES, planJobFor } from "@/lib/client/selectRunner";
import { fitSize, pickFrameTimes } from "@/lib/client/buildPlanRequest";

test("only the time-limit message asks for a lighter retry", () => {
  assert.equal(isTimeLimitFailure(TIME_LIMIT_FAIL), true);
  assert.equal(isTimeLimitFailure("The connection dropped before the plan finished. Try again."), false);
  assert.equal(isTimeLimitFailure(""), false);
  assert.equal(isTimeLimitFailure(undefined), false);
});

test("a light real run has its own runner, and the mock runner is the same either way", () => {
  assert.notEqual(planJobFor("api", true), planJobFor("api"));
  assert.equal(planJobFor("api", false), planJobFor("api"));
  assert.equal(planJobFor("mock", true), planJobFor("mock"));
});

test("the light settings are smaller than the defaults", () => {
  assert.ok(LIGHT_MAX_FRAMES < 48);
  const full = fitSize(1920, 1080);
  const light = fitSize(1920, 1080, LIGHT_LONG_SIDE);
  assert.equal(light.w, LIGHT_LONG_SIDE);
  assert.ok(light.w < full.w && light.h < full.h);
  assert.ok(pickFrameTimes(90, LIGHT_MAX_FRAMES).length <= LIGHT_MAX_FRAMES);
  assert.ok(pickFrameTimes(90).length > LIGHT_MAX_FRAMES);
});
