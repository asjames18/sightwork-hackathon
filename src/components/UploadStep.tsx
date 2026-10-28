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
  // The picker button unmounts once a video is chosen, so move focus to the preview card
  // instead of letting keyboard and screen-reader users fall back to the top of the page.
  const card = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const [check, setCheck] = useState<Check>({ kind: "reading" });
  // Read in an effect so the server render and the first client render match.
  const [runner, setRunner] = useState<RunnerKind>("mock");
  useEffect(() => {
    setRunner(pickRunnerKind(window.location.search, process.env.NEXT_PUBLIC_SIGHTWORK_RUNNER));
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => { if (preview) card.current?.focus(); }, [preview]);

  const durationSec = check.kind === "ok" || check.kind === "warn" ? check.durationSec : null;
  const canSend = check.kind === "ok" || check.kind === "warn";
  // Polite announcement for the length check; warnings and blocks have their own status/alert below.
  const liveText =
    check.kind === "reading" ? "Checking the video length." : check.kind === "ok" ? `Video is ${formatDuration(check.durationSec)} long. Ready to make your plan.` : "";
  const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="mt-6 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-ink/20 bg-white px-6 py-7 text-center transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-safe:active:scale-[.99]"
          >
            <CameraIcon />
            <span className="rounded-xl bg-accent-dark px-5 py-3 text-base font-semibold text-white">Record or choose a video</span>
            <span className="text-sm text-ink/70">MP4 or MOV, about 60 to 90 seconds</span>
          </button>
          <button
            type="button"
            onClick={onExample}
            className={`mt-3 min-h-[44px] w-full rounded-xl border border-ink/20 bg-white/60 px-5 py-2.5 text-center text-base font-semibold text-ink hover:border-ink/40 ${ring}`}
          >
            See an example plan first
          </button>
          <FilmingTips />
        </>
      ) : (
        <div
          ref={card}
          tabIndex={-1}
          role="group"
          aria-label="Your walkthrough"
          className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm focus:outline-none"
        >
          <p aria-live="polite" className="sr-only">{liveText}</p>
          {/* Phone walkthroughs are usually portrait: cap the height and letterbox instead of forcing 16:9. */}
          <video
            key={preview.url}
            src={preview.url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[60vh] w-full bg-black object-contain [@media(min-width:640px)_and_(max-height:820px)]:max-h-[38vh]"
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
              aria-label="Change video"
              className={`-my-2 min-h-[44px] shrink-0 rounded px-2 text-sm font-medium underline ${ring}`}
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
              className={`w-full rounded-xl bg-ink px-5 py-4 text-lg font-semibold text-white active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40 ${ring}`}
            >
              {check.kind === "reading" ? "Checking video…" : "Make my work plan"}
            </button>
            <p className="mt-2 text-center text-sm text-ink/70">
              {runner === "api"
                ? "Frames and narration are sent to make your plan. The full video stays on this device."
                : "Preview build: your video stays on this device and an example plan is shown."}
            </p>
          </div>
        </div>
      )}

      {preview ? (
        <button
          type="button"
          onClick={onExample}
          className={`mt-4 min-h-[44px] w-full rounded text-center text-sm font-medium text-accent-dark underline ${ring}`}
        >
          See an example plan first
        </button>
      ) : null}
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
    <ul
      aria-label="Tips for a good walkthrough"
      className="mt-5 divide-y divide-ink/10 rounded-xl bg-white/70"
    >
      {FILMING_TIPS.map((t, i) => (
        <li key={t.title} className="flex gap-3 px-3 py-2.5">
          <span
            aria-hidden
            className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xs font-bold"
          >
            {i + 1}
          </span>
          <p className="min-w-0 text-sm text-ink/70">
            <span className="font-semibold text-ink">{t.title}.</span> {t.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Simple outline video camera, drawn in SVG so it renders the same on every phone. */
function CameraIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-10 w-10 text-ink/70"
    >
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3" />
    </svg>
  );
}
