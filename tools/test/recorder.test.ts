/** In-page recorder helpers: codec pick, camera request ladder, error wording, timer limits. No browser. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  averageBitrate,
  baseMime,
  cameraConstraintLadder,
  cameraFailureMessage,
  classifyCameraError,
  describeResolution,
  elapsedState,
  extensionForMime,
  isConstraintError,
  MIME_CANDIDATES,
  pickRecordingMimeType,
  RECORD_VIDEO_BPS,
  recordingFileName,
  secondsLeft,
} from "@/lib/client/recorder";
import { HARD_MAX_SEC, SOFT_MAX_SEC } from "@/lib/client/duration";

describe("recording format", () => {
  test("MP4 (H.264) first for iOS Safari, then WebM VP9, VP8", () => {
    assert.match(MIME_CANDIDATES[0], /^video\/mp4;codecs=avc1/);
    const vp9 = MIME_CANDIDATES.indexOf("video/webm;codecs=vp9,opus");
    const vp8 = MIME_CANDIDATES.indexOf("video/webm;codecs=vp8,opus");
    assert.ok(MIME_CANDIDATES.lastIndexOf("video/mp4") < vp9 && vp9 < vp8);
  });
  test("picks the first supported type", () => {
    assert.equal(pickRecordingMimeType(() => true), MIME_CANDIDATES[0]);
    assert.equal(pickRecordingMimeType((t) => t === "video/mp4"), "video/mp4"); // older iOS Safari
    assert.equal(pickRecordingMimeType((t) => t.startsWith("video/webm")), "video/webm;codecs=vp9,opus"); // Chromium
    assert.equal(pickRecordingMimeType((t) => t === "video/webm;codecs=vp8,opus"), "video/webm;codecs=vp8,opus");
    assert.equal(pickRecordingMimeType(() => false), "");
    assert.equal(
      pickRecordingMimeType(() => {
        throw new Error("bad");
      }),
      "",
    );
  });
  test("about 8 Mbps video", () => assert.equal(RECORD_VIDEO_BPS, 8_000_000));
  test("file name, extension and container type", () => {
    const at = new Date(2026, 9, 29, 21, 5);
    assert.equal(recordingFileName("video/mp4;codecs=avc1", at), "walkthrough-2026-10-29-2105.mp4");
    assert.equal(recordingFileName("video/webm;codecs=vp9,opus", at), "walkthrough-2026-10-29-2105.webm");
    assert.equal(extensionForMime(""), "webm");
    assert.equal(baseMime("video/webm;codecs=vp8,opus"), "video/webm");
    assert.equal(baseMime(""), "video/webm");
  });
});

describe("camera request", () => {
  test("first ask: back camera, 1920x1080 ideal, 30 fps, with audio", () => {
    const [first, ...rest] = cameraConstraintLadder();
    const v = first.video as MediaTrackConstraints;
    assert.deepEqual(v.facingMode, { ideal: "environment" });
    assert.deepEqual(v.width, { ideal: 1920 });
    assert.deepEqual(v.height, { ideal: 1080 });
    assert.deepEqual(v.frameRate, { ideal: 30 });
    assert.ok(first.audio);
    // Looser fallbacks keep audio, and nothing is "exact"/"min", so no phone fails on size alone.
    assert.equal(rest.length, 2);
    for (const c of rest) assert.ok(c.audio);
    assert.doesNotMatch(JSON.stringify(cameraConstraintLadder()), /exact|min/);
  });
  test("only constraint errors loosen the request; a 'no' does not re-prompt", () => {
    assert.ok(isConstraintError("OverconstrainedError"));
    assert.ok(isConstraintError("TypeError"));
    assert.ok(!isConstraintError("NotAllowedError"));
    assert.ok(!isConstraintError(undefined));
  });
  test("errors map to plain messages that point at the camera app", () => {
    assert.equal(classifyCameraError("NotAllowedError"), "denied");
    assert.equal(classifyCameraError("NotFoundError"), "no-camera");
    assert.equal(classifyCameraError("NotReadableError"), "busy");
    assert.equal(classifyCameraError("SecurityError"), "insecure");
    assert.equal(classifyCameraError("Weird"), "other");
    for (const f of ["unsupported", "denied", "no-camera", "busy", "insecure", "other"] as const)
      assert.match(cameraFailureMessage(f), /camera app/);
  });
  test("resolution label", () => {
    assert.equal(describeResolution({ width: 1920, height: 1080 }), "1920\u00d71080");
    assert.equal(describeResolution({ width: 1080 }), null);
    assert.equal(describeResolution(null), null);
  });
});

describe("take length", () => {
  test("states follow the upload limits", () => {
    assert.equal(elapsedState(0), "short");
    assert.equal(elapsedState(5), "ok");
    assert.equal(elapsedState(SOFT_MAX_SEC), "ok");
    assert.equal(elapsedState(SOFT_MAX_SEC + 0.1), "long");
    assert.equal(elapsedState(HARD_MAX_SEC - 0.01), "long");
    assert.equal(elapsedState(HARD_MAX_SEC), "max");
    assert.equal(secondsLeft(140.2), 10);
    assert.equal(secondsLeft(200), 0);
  });
  test("average bitrate", () => {
    assert.equal(averageBitrate(1_000_000, 1), 8_000_000);
    assert.equal(averageBitrate(0, 3), 0);
    assert.equal(averageBitrate(10, 0), 0);
  });
});

test("a refused or missing mic retries with the camera alone, not on constraint errors", async () => {
  const { shouldRetryWithoutMic, videoOnlyConstraints } = await import("@/lib/client/recorder");
  for (const n of ["NotAllowedError", "PermissionDeniedError", "NotFoundError", "DevicesNotFoundError", "NotReadableError", "TrackStartError"]) {
    assert.equal(shouldRetryWithoutMic(n), true, n);
  }
  for (const n of ["OverconstrainedError", "TypeError", "SecurityError", "AbortError", undefined]) {
    assert.equal(shouldRetryWithoutMic(n), false, String(n));
  }
  const c = videoOnlyConstraints();
  assert.equal(c.audio, false);
  assert.deepEqual(c.video, cameraConstraintLadder()[0].video, "same camera request as the first try");
  assert.doesNotMatch(JSON.stringify(c), /exact|min/);
});
