/**
 * Pure helpers behind the in-page camera recorder on the upload screen (no browser globals, so
 * tools/test can check them). The component lives in src/components/CameraRecorder.tsx.
 */
import { aimRangeSpoken, durationRulesFor, formatDuration, type DurationRules } from "./duration";

/** About 8 Mbps: a sharp 1080p30 take (phone camera apps use roughly 8 to 17 Mbps at 1080p). */
export const RECORD_VIDEO_BPS = 8_000_000;
export const RECORD_AUDIO_BPS = 128_000;

/**
 * Container/codec choices, best first. MP4 (H.264 + AAC) first: it's what iOS Safari records and it
 * plays everywhere; then WebM VP9 / VP8 with Opus for Chrome, Firefox and Android.
 */
export const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

/** First type the browser can record, or "" to let MediaRecorder pick its own default. */
export function pickRecordingMimeType(isTypeSupported: (type: string) => boolean): string {
  for (const t of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(t)) return t;
    } catch {
      // Some browsers throw on unknown codec strings; treat as unsupported.
    }
  }
  return "";
}

/**
 * Camera requests tried in order. The first asks for 1080p30 from the back camera (ideal values, so a
 * phone that can't do 1080p hands back its closest mode instead of failing); the later ones only run
 * when a browser rejects the constraints themselves (OverconstrainedError / TypeError), not on a
 * permission "no". Audio is on: narration feeds the plan.
 */
export function cameraConstraintLadder(): MediaStreamConstraints[] {
  return [
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
    },
    { video: { facingMode: { ideal: "environment" } }, audio: true },
    { video: true, audio: true },
  ];
}

/**
 * Camera without the microphone: the last try after a request with audio was refused or found no mic
 * (mic blocked while the camera is allowed, no mic, or a mic held by a call or a headset). The take then
 * records video only and the screen says the plan will use the video only.
 */
export function videoOnlyConstraints(): MediaStreamConstraints {
  return { video: cameraConstraintLadder()[0].video, audio: false };
}

/** Errors from a camera-plus-mic request worth one more try with the camera alone. */
export function shouldRetryWithoutMic(name: string | undefined): boolean {
  return (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "NotReadableError" ||
    name === "TrackStartError"
  );
}

/** Errors that mean "these constraints don't fit this camera", worth retrying with looser ones. */
export function isConstraintError(name: string | undefined): boolean {
  return name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError" || name === "TypeError";
}

export type CameraFailure = "unsupported" | "denied" | "no-camera" | "busy" | "insecure" | "other";

export function classifyCameraError(name: string | undefined): CameraFailure {
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "no-camera";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    case "SecurityError":
      return "insecure";
    default:
      return "other";
  }
}

/** Plain-language line for a camera that couldn't open; the screen offers the phone's camera app next. */
export function cameraFailureMessage(f: CameraFailure): string {
  switch (f) {
    case "unsupported":
    case "insecure":
      return "This browser can't open the camera here. Use your phone's camera app instead.";
    case "denied":
      return "Camera or microphone access was blocked. Allow it in your browser settings, or use your camera app instead.";
    case "no-camera":
      return "We couldn't find a camera on this device. Use your camera app, or choose a video you already have.";
    case "busy":
      return "The camera is busy in another app. Close it and try again, or use your camera app instead.";
    default:
      return "The camera didn't start. Try again, or use your camera app instead.";
  }
}

/** "1920×1080" from a track's settings, or null when the browser doesn't say. */
export function describeResolution(s: { width?: number; height?: number } | null | undefined): string | null {
  if (!s || !s.width || !s.height) return null;
  return `${Math.round(s.width)}\u00d7${Math.round(s.height)}`;
}

/** File extension for a recorded MIME type. */
export function extensionForMime(mime: string): "mp4" | "webm" {
  return /^video\/mp4/i.test(mime) ? "mp4" : "webm";
}

/** "walkthrough-2026-10-29-2122.mp4" (local time, so it matches the phone's clock). */
export function recordingFileName(mime: string, at: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}`;
  return `walkthrough-${stamp}.${extensionForMime(mime)}`;
}

/** The container part of a MIME type, for File.type ("video/mp4;codecs=..." -> "video/mp4"). */
export function baseMime(mime: string): string {
  return (mime.split(";")[0] || "").trim() || "video/webm";
}

export type ElapsedState = "short" | "ok" | "long" | "max";

/**
 * Where a running take is against the chosen room size's length rules (duration.ts): under 5 s, fine,
 * past the size's warn point (wrap up), at its cap (stop). Medium when no rules are passed.
 */
export function elapsedState(sec: number, rules: DurationRules = durationRulesFor()): ElapsedState {
  if (sec >= rules.hardMaxSec) return "max";
  if (sec > rules.warnAfterSec) return "long";
  if (sec < rules.minSec) return "short";
  return "ok";
}

/** Seconds left before the automatic stop at the size's cap. */
export function secondsLeft(sec: number, rules: DurationRules = durationRulesFor()): number {
  return Math.max(0, Math.ceil(rules.hardMaxSec - sec));
}

/** Average bitrate of a finished take in bits per second (0 when it can't be worked out). */
export function averageBitrate(bytes: number, durationSec: number): number {
  return durationSec > 0 && bytes > 0 ? Math.round((bytes * 8) / durationSec) : 0;
}

export type TakeZone = "early" | "aim" | "long";

export interface TakeMeter {
  /** How much of the size's cap the take has used, 0..100. */
  fillPct: number;
  /** The aim range as a band on the same 0..100 scale (ends at the wrap-up point when that comes first). */
  aimStartPct: number;
  aimEndPct: number;
  /** Before the aim range, inside it, or past the wrap-up point. */
  zone: TakeZone;
  /** Short text for the bar: "Keep going", "Good length", "Wrap up". */
  label: string;
  /** Full text for screen readers: "1:10 of 2:00. Good length. Aim for 60 to 90 seconds." */
  valueText: string;
}

const pct = (sec: number, cap: number) => Math.min(100, Math.max(0, Math.round((sec / cap) * 1000) / 10));

/**
 * The take meter on the live preview: how far the take is toward the size's automatic stop, with the
 * size's aim range marked, so a walker can see when the length is right without reading numbers.
 */
export function takeMeter(sec: number, rules: DurationRules = durationRulesFor()): TakeMeter {
  const cap = rules.hardMaxSec > 0 ? rules.hardMaxSec : 1;
  const s = Number.isFinite(sec) ? Math.max(0, sec) : 0;
  const aimEnd = Math.min(rules.aimMaxSec, rules.warnAfterSec);
  const zone: TakeZone = s > rules.warnAfterSec ? "long" : s >= rules.aimMinSec ? "aim" : "early";
  const label = zone === "long" ? "Wrap up" : zone === "aim" ? "Good length" : "Keep going";
  return {
    fillPct: pct(s, cap),
    aimStartPct: pct(rules.aimMinSec, cap),
    aimEndPct: pct(aimEnd, cap),
    zone,
    label,
    valueText: `${formatDuration(s)} of ${formatDuration(cap)}. ${label}. Aim for ${aimRangeSpoken(rules)}.`,
  };
}

/** Why a take stopped before Stop was tapped: the page went to the background, or the camera track ended. */
export type TakeInterruption = "hidden" | "camera-ended";

/**
 * Note for the take card when a recording stopped on its own mid-walk (a call came in, the walker switched
 * apps, or another app took the camera). What was recorded is kept, so the note says why it stopped and
 * whether the kept part is long enough to use. Null when the take wasn't interrupted.
 */
export function interruptedTakeNote(
  reason: TakeInterruption | null | undefined,
  sec: number,
  rules: DurationRules = durationRulesFor(),
): string | null {
  if (reason !== "hidden" && reason !== "camera-ended") return null;
  const lead =
    reason === "hidden" ? "Recording stopped when you left the page." : "Recording stopped because the camera turned off.";
  const s = Number.isFinite(sec) ? Math.max(0, sec) : 0;
  const len = formatDuration(s);
  if (s < rules.minSec) return `${lead} Only ${len} was recorded, too short for a plan.`;
  if (s < rules.aimMinSec) {
    return `${lead} We kept the ${len} you recorded. That's short for a ${rules.label.toLowerCase()} space (aim for ${aimRangeSpoken(rules)}), so record again if you missed part of it.`;
  }
  return `${lead} We kept the ${len} you recorded, which is enough to make your plan.`;
}
