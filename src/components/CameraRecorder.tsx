"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration, HARD_MAX_SEC, SOFT_MAX_SEC } from "@/lib/client/duration";
import { isTooQuiet, nextQuietSince, openMicMeter, smoothLevel } from "@/lib/client/micLevel";
import { keepScreenOn } from "@/lib/client/wakeLock";
import {
  averageBitrate,
  baseMime,
  cameraConstraintLadder,
  cameraFailureMessage,
  classifyCameraError,
  describeResolution,
  elapsedState,
  isConstraintError,
  pickRecordingMimeType,
  RECORD_AUDIO_BPS,
  RECORD_VIDEO_BPS,
  recordingFileName,
  secondsLeft,
} from "@/lib/client/recorder";

export interface RecordingInfo {
  /** Camera resolution the browser actually delivered, e.g. "1920×1080" (null if it didn't say). */
  resolution: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  mimeType: string;
  /** Average bits per second of the finished file, audio included. */
  bitsPerSecond: number;
  durationSec: number;
}

/** True when this browser can open the camera and record in the page. */
export function canRecordInPage(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder === "function"
  );
}

type Phase = "starting" | "ready" | "recording" | "finishing";

/**
 * In-page camera: back camera at 1080p30 (ideal, so the closest mode the phone has), live preview,
 * start/stop with a timer that stops itself at the 2½-minute hard limit, recorded with MediaRecorder at
 * about 8 Mbps so the take isn't squeezed. The finished take comes back as a File, the same as a
 * picked video. Every camera and mic track is stopped on stop, cancel and unmount.
 */
export function CameraRecorder({
  onRecorded,
  onCancel,
  onUnavailable,
}: {
  onRecorded: (file: File, info: RecordingInfo) => void;
  onCancel: () => void;
  /** The camera couldn't open (no support, blocked, missing, busy); the message says why in plain words. */
  onUnavailable: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const discardRef = useRef(false);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [settings, setSettings] = useState<MediaTrackSettings | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // Live mic level (0..1), whether the stream has a mic at all, and the "can't hear you" hint.
  const [level, setLevel] = useState(0);
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [tooQuiet, setTooQuiet] = useState(false);
  // Keep the latest callbacks without restarting the camera when the parent re-renders.
  const cb = useRef({ onRecorded, onCancel, onUnavailable });
  useEffect(() => {
    cb.current = { onRecorded, onCancel, onUnavailable };
  });

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stopTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  // Open the camera once on mount; release everything on unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!canRecordInPage()) {
        cb.current.onUnavailable(cameraFailureMessage("unsupported"));
        return;
      }
      let stream: MediaStream | null = null;
      let lastName: string | undefined;
      for (const c of cameraConstraintLadder()) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          lastName = (e as { name?: string })?.name;
          // Only loosen the request when the constraints were the problem, not on a "no".
          if (!isConstraintError(lastName)) break;
        }
      }
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!stream) {
        cb.current.onUnavailable(cameraFailureMessage(classifyCameraError(lastName)));
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      setSettings(track?.getSettings?.() ?? null);
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.play().catch(() => {});
      }
      setHasMic(stream.getAudioTracks().length > 0);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
      discardRef.current = true;
      if (tickRef.current) clearInterval(tickRef.current);
      const r = recorderRef.current;
      if (r && r.state !== "inactive") {
        try {
          r.stop();
        } catch {
          // already stopped
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    stopTick();
    if (r && r.state !== "inactive") {
      setPhase("finishing");
      r.stop();
    }
  }, [stopTick]);

  const start = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickRecordingMimeType((t) => MediaRecorder.isTypeSupported(t));
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: RECORD_VIDEO_BPS,
        audioBitsPerSecond: RECORD_AUDIO_BPS,
      });
    } catch {
      try {
        rec = new MediaRecorder(stream, { videoBitsPerSecond: RECORD_VIDEO_BPS });
      } catch {
        stopTracks();
        cb.current.onUnavailable(cameraFailureMessage("other"));
        return;
      }
    }
    const chunks: Blob[] = [];
    discardRef.current = false;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      const durationSec = (performance.now() - startedAtRef.current) / 1000;
      const type = rec.mimeType || mimeType || "video/webm";
      const track = streamRef.current?.getVideoTracks()[0];
      const s = track?.getSettings?.() ?? settings ?? {};
      stopTracks();
      if (discardRef.current) return;
      const blob = new Blob(chunks, { type: baseMime(type) });
      const file = new File([blob], recordingFileName(type, new Date()), { type: baseMime(type), lastModified: Date.now() });
      cb.current.onRecorded(file, {
        resolution: describeResolution(s),
        width: s.width ?? null,
        height: s.height ?? null,
        frameRate: s.frameRate ? Math.round(s.frameRate) : null,
        mimeType: type,
        bitsPerSecond: averageBitrate(blob.size, durationSec),
        durationSec,
      });
    };
    recorderRef.current = rec;
    // Chunks every second, so a stop always has data and memory use stays even.
    rec.start(1000);
    startedAtRef.current = performance.now();
    setElapsed(0);
    setPhase("recording");
    tickRef.current = setInterval(() => {
      const sec = (performance.now() - startedAtRef.current) / 1000;
      setElapsed(sec);
      if (elapsedState(sec) === "max") stop();
    }, 250);
  }, [settings, stop, stopTracks]);

  // Keep the screen on while the camera is open, so auto-lock can't end a take mid-walk.
  const cameraOpen = phase === "ready" || phase === "recording";
  useEffect(() => {
    if (!cameraOpen) return;
    return keepScreenOn();
  }, [cameraOpen]);

  // Mic meter while the camera is open. The quiet hint only counts time while recording.
  useEffect(() => {
    if (!cameraOpen || !streamRef.current) return;
    const meter = openMicMeter(streamRef.current);
    if (!meter) return;
    let smoothed = 0;
    let quietSince: number | null = null;
    const id = setInterval(() => {
      smoothed = smoothLevel(smoothed, meter.read());
      setLevel(smoothed);
      if (phase === "recording") {
        const now = performance.now() / 1000;
        quietSince = nextQuietSince(quietSince, smoothed, now);
        setTooQuiet(isTooQuiet(quietSince, now));
      }
    }, 100);
    return () => {
      clearInterval(id);
      meter.close();
      setTooQuiet(false);
    };
  }, [cameraOpen, phase]);

  const cancel = useCallback(() => {
    discardRef.current = true;
    stopTick();
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    stopTracks();
    cb.current.onCancel();
  }, [stopTick, stopTracks]);

  const resolution = describeResolution(settings);
  const state = elapsedState(elapsed);
  const recording = phase === "recording";

  return (
    <div
      role="group"
      aria-label="Camera"
      className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/10"
      data-phase={phase}
      data-width={settings?.width ?? ""}
      data-height={settings?.height ?? ""}
    >
      <div className="relative bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-label="Live camera preview"
          className="max-h-[60vh] w-full bg-black object-contain [@media(min-width:640px)_and_(max-height:820px)]:max-h-[38vh]"
        />
        {phase === "starting" && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/90">
            Opening the camera… Allow camera and microphone if your browser asks.
          </p>
        )}
        {recording && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold tabular-nums text-white">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-red-500 motion-safe:animate-pulse" />
            {formatDuration(elapsed)}
          </span>
        )}
        {cameraOpen && hasMic && (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white"
            data-testid="mic-level"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
            <span className="sr-only">Microphone level</span>
            <span aria-hidden className="relative h-1.5 w-12 overflow-hidden rounded-full bg-white/30">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-400 transition-[width] duration-100"
                style={{ width: `${Math.round(Math.max(level, 0.04) * 100)}%` }}
              />
            </span>
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-sm text-ink/70" data-testid="recording-resolution">
          {resolution ? (
            <>
              {recording ? "Recording at " : "Camera ready at "}
              <span className="font-semibold text-ink">{resolution}</span>
              {settings?.frameRate ? <> · {Math.round(settings.frameRate)} fps</> : null}
            </>
          ) : phase === "starting" ? (
            "Starting camera…"
          ) : (
            "Camera ready"
          )}
        </p>
        <p aria-live="polite" className="sr-only">
          {recording ? "Recording started." : phase === "finishing" ? "Recording stopped." : phase === "ready" ? "Camera ready." : ""}
        </p>
        {recording && state === "long" && (
          <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Past {formatDuration(SOFT_MAX_SEC)}: wrap up soon. Recording stops by itself in {secondsLeft(elapsed)} s.
          </p>
        )}
        {recording && tooQuiet && (
          <p role="status" className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900" data-testid="mic-quiet">
            We can&apos;t hear you. Say what you see as you walk, like &ldquo;this chair is broken.&rdquo;
          </p>
        )}
        {cameraOpen && hasMic === false && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="mic-missing">
            No microphone, so the plan will use the video only. Allow the microphone to add your narration.
          </p>
        )}
        {recording && state === "short" && (
          <p className="mt-2 text-sm text-ink/70">Walk the whole space, about 60 to 90 seconds.</p>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {recording || phase === "finishing" ? (
            <button
              type="button"
              onClick={stop}
              disabled={phase === "finishing"}
              className="btn-primary w-full text-lg sm:flex-1"
            >
              <span aria-hidden className="mr-2 inline-block h-3.5 w-3.5 rounded-sm bg-white" />
              {phase === "finishing" ? "Saving…" : "Stop recording"}
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={phase !== "ready"}
              className="btn-primary w-full text-lg sm:flex-1"
            >
              <span aria-hidden className="mr-2 inline-block h-3.5 w-3.5 rounded-full bg-red-500 ring-2 ring-white" />
              Start recording
            </button>
          )}
          <button type="button" onClick={cancel} className="btn-secondary w-full sm:w-auto">
            Cancel
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-ink/65">
          Stops by itself at {formatDuration(HARD_MAX_SEC)}. Hold the phone steady and talk as you walk.
        </p>
      </div>
    </div>
  );
}
