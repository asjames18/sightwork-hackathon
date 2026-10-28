"use client";

import { useEffect, useRef, useState } from "react";
import { pickRunnerKind, type RunnerKind } from "@/lib/client/selectRunner";

/** Walkthroughs work best at 60 to 90 seconds; past this we warn, past the hard limit we block. */
const SOFT_MAX_SEC = 95;
const HARD_MAX_SEC = 150;
const MIN_SEC = 5;

type Check =
  | { kind: "reading" }
  | { kind: "ok"; durationSec: number }
  | { kind: "warn"; durationSec: number; message: string }
  | { kind: "block"; message: string };

/** Plain-language verdict on a picked video's length. Pure, so it can be checked without a browser. */
export function checkDuration(durationSec: number): Check {
  if (!Number.isFinite(durationSec) || durationSec <= 0)
    return { kind: "block", message: "We couldn't read this video's length. Try recording again, or pick an MP4." };
  if (durationSec < MIN_SEC)
    return { kind: "block", message: "That clip is only a few seconds. Walk the whole space for 60 to 90 seconds." };
  if (durationSec > HARD_MAX_SEC)
    return { kind: "block", message: "That video is over 2½ minutes. Trim it to about 90 seconds, or record a shorter walkthrough." };
  if (durationSec > SOFT_MAX_SEC)
    return { kind: "warn", durationSec, message: "A bit long. It will still work, but 60 to 90 seconds gives the sharpest plan." };
  return { kind: "ok", durationSec };
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function UploadStep({ onVideo, onExample }: { onVideo: (file: File) => void; onExample: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const [check, setCheck] = useState<Check>({ kind: "reading" });
  // Read in an effect so the server render and the first client render match.
  const [runner, setRunner] = useState<RunnerKind>("mock");
  useEffect(() => {
    setRunner(pickRunnerKind(window.location.search, process.env.NEXT_PUBLIC_SIGHTWORK_RUNNER));
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const durationSec = check.kind === "ok" || check.kind === "warn" ? check.durationSec : null;
  const canSend = check.kind === "ok" || check.kind === "warn";

  return (
    <section>
      <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Film a walkthrough. Get a work plan.</h1>
      <p className="mt-3 text-ink/70">
        Walk the space for 60 to 90 seconds and say what needs work. SightWork counts what&apos;s there, finds the problems
        (including the ones you didn&apos;t mention), and lays out the work in order.
      </p>

      <input
        ref={input}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Clear so picking the same file again still fires a change.
          e.target.value = "";
          if (!file) return;
          setCheck({ kind: "reading" });
          setPreview({ url: URL.createObjectURL(file), file });
        }}
      />

      {!preview ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-8 flex min-h-[176px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/25 bg-white px-6 py-10 text-center transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[.99]"
        >
          <span aria-hidden className="text-4xl">🎥</span>
          <span className="text-lg font-semibold">Record or choose a video</span>
          <span className="text-sm text-ink/65">MP4 or MOV, about 60 to 90 seconds</span>
        </button>
      ) : null}

      {!preview ? (
        <FilmingTips />
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
          {/* Phone walkthroughs are usually portrait: cap the height and letterbox instead of forcing 16:9. */}
          <video
            key={preview.url}
            src={preview.url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[60vh] w-full bg-black object-contain"
            onLoadedMetadata={(e) => setCheck(checkDuration(e.currentTarget.duration))}
            onError={() =>
              setCheck({ kind: "block", message: "This browser can't play that video. Try an MP4, or record it again here." })
            }
          />
          <div className="flex items-center justify-between gap-3 p-4">
            <p className="min-w-0 truncate text-sm text-ink/70">
              {preview.file.name}
              {durationSec !== null && <span className="text-ink/65"> · {formatDuration(durationSec)}</span>}
            </p>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="-my-2 min-h-[44px] shrink-0 px-2 text-sm font-medium underline"
            >
              Change
            </button>
          </div>
          {(check.kind === "warn" || check.kind === "block") && (
            <p
              role={check.kind === "block" ? "alert" : "status"}
              className={`mx-4 mb-3 rounded-lg px-3 py-2 text-sm ${
                check.kind === "block" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"
              }`}
            >
              {check.message}
            </p>
          )}
          <div className="px-4 pb-4">
            <button
              type="button"
              disabled={!canSend}
              onClick={() => onVideo(preview.file)}
              className="w-full rounded-xl bg-ink px-5 py-4 text-lg font-semibold text-white active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {check.kind === "reading" ? "Checking video…" : "Make my work plan"}
            </button>
            <p className="mt-2 text-center text-xs text-ink/65">
              {runner === "api"
                ? "Frames and narration are sent to make your plan. The full video stays on this device."
                : "Preview build: your video stays on this device and an example plan is shown."}
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onExample}
        className="mt-4 min-h-[44px] w-full text-center text-sm font-medium text-[#c2410c] underline"
      >
        See an example plan first
      </button>
    </section>
  );
}

/** What makes a walkthrough read well. Shown before a video is picked; no narration is needed. */
export const FILMING_TIPS: { title: string; detail: string }[] = [
  { title: "Walk slowly, edge to edge", detail: "Pan across every wall, row and corner so nothing is counted twice or missed." },
  { title: "Pause on problems", detail: "Hold for a second on damage, stains or broken items so they get a clear proof frame." },
  { title: "Talking is optional", detail: "Say what needs work if you like. A silent walkthrough still gets a full plan." },
];

function FilmingTips() {
  return (
    <ul aria-label="Tips for a good walkthrough" className="mt-4 grid gap-2 sm:grid-cols-3">
      {FILMING_TIPS.map((t, i) => (
        <li key={t.title} className="flex gap-3 rounded-xl bg-white/70 p-3 sm:flex-col sm:gap-1">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xs font-bold"
          >
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t.title}</span>
            <span className="block text-xs text-ink/65">{t.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
