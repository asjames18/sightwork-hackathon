"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pickRunnerKind, type RunnerKind } from "@/lib/client/selectRunner";
import { loadLastPlan } from "@/lib/client/lastPlan";
import { EXAMPLES, type Example } from "@/lib/examples";
import { loadTestCode, saveTestCode } from "@/lib/client/testCode";
import { checkDuration, formatDuration, type Check } from "@/lib/client/duration";

/** Browsers leave `type` empty for some .mov files, so fall back to the extension. */
function isVideoFile(f: File): boolean {
  return f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name);
}

// Whether a finished plan is saved on this device. The server render and the first client render
// both say no, so there's no hydration mismatch; another tab saving or clearing one updates it.
const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const hasSavedPlan = () => loadLastPlan() !== null;
const noPlanOnServer = () => false;

export function UploadStep({
  onVideo,
  onExample,
  onLastPlan,
}: {
  onVideo: (file: File) => void;
  /** Opens an example plan by id (the featured real run when omitted). */
  onExample: (id?: string) => void;
  /** Reopens the last finished plan on this device; the link only shows when one is saved. */
  onLastPlan?: () => void;
}) {
  const savedPlan = useSyncExternalStore(subscribeStorage, hasSavedPlan, noPlanOnServer);
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

  const pick = useCallback((file: File) => {
    setDropError(false);
    setCheck({ kind: "reading" });
    setPreview({ url: URL.createObjectURL(file), file });
  }, []);
  // Desktop: drop a video anywhere on the upload screen (dropping it outside a target used to make the
  // browser open the file in the tab and leave the app). The drop zone lights up while a file is dragged.
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState(false);
  useEffect(() => {
    if (preview) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = Array.from(e.dataTransfer?.files ?? []).find(isVideoFile);
      if (file) pick(file);
      else setDropError(true);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [preview, pick]);

  const durationSec = check.kind === "ok" || check.kind === "warn" ? check.durationSec : null;
  const canSend = check.kind === "ok" || check.kind === "warn";
  // Polite announcement for the length check; warnings and blocks have their own status/alert below.
  const liveText =
    check.kind === "reading" ? "Checking the video length." : check.kind === "ok" ? `Video is ${formatDuration(check.durationSec)} long. Ready to make your plan.` : "";

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
          pick(file);
        }}
      />

      {!preview ? (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={`mt-6 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 px-6 py-7 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-safe:active:scale-[.99] ${
              dragging ? "border-dashed border-accent-dark bg-accent/5" : "border-ink/20 bg-white hover:border-ink/40"
            }`}
          >
            <CameraIcon />
            <span className="rounded-xl bg-accent-dark px-5 py-3 text-base font-semibold text-white">
              {dragging ? "Drop your video here" : "Record or choose a video"}
            </span>
            <span className="text-sm text-ink/70">
              MP4 or MOV, about 60 to 90 seconds<span className="hidden [@media(pointer:fine)]:inline">. Or drag it here.</span>
            </span>
          </button>
          {dropError && (
            <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              That file isn&apos;t a video. Drop an MP4 or MOV walkthrough.
            </p>
          )}
          {savedPlan && onLastPlan ? (
            <p className="mt-2 text-center text-base">
              <button
                type="button"
                onClick={onLastPlan}
                className="btn-tertiary"
              >
                Open my last plan
              </button>
            </p>
          ) : null}
          {runner === "api" && <TesterCode />}
          <FilmingTips />
          <ExamplePicker onPick={onExample} />
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
              className="btn-tertiary -my-2 shrink-0 text-sm"
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
              className="btn-primary w-full text-lg motion-safe:active:scale-[.99]"
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
          onClick={() => onExample()}
          className="btn-tertiary mt-4 w-full text-sm"
        >
          See an example plan first
        </button>
      ) : null}
    </section>
  );
}

/**
 * "How to film": what makes a walkthrough read well, shown before a video is picked. Based on capture
 * guidance for walkthrough scanning and video inspection apps (slow, steady, well lit, each area once,
 * name the area, say the problems). Wording stays general so it fits any kind of space.
 */
export const FILMING_TIPS: { icon: TipIcon; title: string; detail: string }[] = [
  { icon: "walk", title: "Walk slowly", detail: "About 1 to 2 feet a second, phone steady in both hands." },
  { icon: "light", title: "Lights on", detail: "Turn on the lights and open the blinds. Dark corners hide damage." },
  { icon: "distance", title: "Stay 3 to 6 feet from walls", detail: "Close enough for detail, far enough to fit whole items." },
  { icon: "once", title: "Cover each area once", detail: "One pass per area, so items aren\u2019t counted twice." },
  { icon: "pin", title: "Name each area", detail: "Say it as you walk in, like \u201cnow the hallway.\u201d" },
  { icon: "speak", title: "Point out problems", detail: "Say what needs work. SightWork also looks for what you don\u2019t mention." },
];

function FilmingTips() {
  return (
    <section aria-labelledby="film-tips-heading" className="mt-6 rounded-2xl bg-white/70 p-4 ring-1 ring-ink/10 sm:p-5">
      <h2 id="film-tips-heading" className="text-lg font-extrabold">
        How to film
      </h2>
      <p className="mt-0.5 text-sm text-ink/70">One steady take of 60 to 90 seconds. Talking is optional, but it helps.</p>
      <ul className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2.5 sm:gap-y-3 sm:grid-cols-2">
        {FILMING_TIPS.map((t) => (
          <li key={t.title} className="flex gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-dark"
            >
              <TipGlyph icon={t.icon} />
            </span>
            <p className="min-w-0 text-sm leading-snug text-ink/70">
              <span className="font-semibold text-ink sm:block">
                {t.title}
                <span className="sm:hidden">.</span>
              </span>{" "}
              {t.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

type TipIcon = "walk" | "light" | "distance" | "once" | "pin" | "speak";

/** Small outline glyphs for the filming tips (decorative; the text carries the meaning). */
function TipGlyph({ icon }: { icon: TipIcon }) {
  const paths: Record<TipIcon, React.ReactNode> = {
    walk: (
      <>
        <circle cx="13" cy="4.5" r="1.75" />
        <path d="m9 21 2.5-6.5L14 17v4M7.5 12l2.5-4.5 3.5 1 2 3.5 2.5 1M11.5 14.5 13 9" />
      </>
    ),
    light: (
      <>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
      </>
    ),
    distance: (
      <>
        <path d="M3 4v16M21 4v16" />
        <path d="M7 12h10M9.5 9.5 7 12l2.5 2.5M14.5 9.5 17 12l-2.5 2.5" />
      </>
    ),
    once: (
      <>
        <path d="M4 17c3-8 9-11 16-10" />
        <path d="m16.5 4 3.5 3-3.5 3.5" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" />
        <circle cx="12" cy="10" r="2.25" />
      </>
    ),
    speak: (
      <>
        <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-8l-4.5 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5Z" />
        <path d="M12 8v3.5M12 13.5v.01" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
    >
      {paths[icon]}
    </svg>
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

/**
 * Example plans before filming: the featured hand-written sample (kitchen renovation) as a wide card, then the real run and other samples
 * for other kinds of spaces. Each card says "Real run" or "Sample" so nothing reads as a model result
 * that wasn't one.
 */
function ExamplePicker({ onPick }: { onPick: (id: string) => void }) {
  const [featured, ...samples] = EXAMPLES;
  return (
    <section aria-labelledby="examples-heading" className="mt-8">
      <h2 id="examples-heading" className="text-lg font-extrabold">
        See a plan first
      </h2>
      <p className="mt-1 text-sm text-ink/70">Samples on real photos of different spaces, plus one real SightWork run.</p>
      <ExampleCard example={featured} onPick={onPick} wide />
      <ul className="mt-3 grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        {samples.map((e) => (
          <li key={e.id}>
            <ExampleCard example={e} onPick={onPick} />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink/60">
        Sample photos are CC0 (free to use), via Wikimedia Commons.{" "}
        <a href="/credits" className="underline underline-offset-2">
          Credits
        </a>
      </p>
    </section>
  );
}

function ExampleCard({ example, onPick, wide = false }: { example: Example; onPick: (id: string) => void; wide?: boolean }) {
  const real = example.kind === "real";
  return (
    <button
      type="button"
      onClick={() => onPick(example.id)}
      className={`group mt-3 flex w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-ink/10 transition hover:ring-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:active:scale-[.99] ${
        wide ? "flex-col sm:flex-row" : "flex-row sm:flex-col"
      }`}
    >
      <span className={`relative block shrink-0 bg-ink ${wide ? "aspect-video w-full sm:w-1/2" : "w-28 sm:aspect-[4/3] sm:w-full"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={example.thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white ${
            real ? "bg-safe-dark" : "bg-ink/80"
          }`}
        >
          {real ? "Real run" : "Sample"}
        </span>
      </span>
      <span className={`flex min-w-0 flex-col justify-center gap-1 ${wide ? "p-4 sm:p-5" : "p-3"}`}>
        <span className={`font-bold leading-snug ${wide ? "text-lg" : "text-base"}`}>{example.title}</span>
        <span className="text-sm text-ink/70">{example.blurb}</span>
        <span className="mt-1 text-sm font-semibold text-accent-dark group-hover:underline">
          Open plan <span aria-hidden>→</span>
        </span>
      </span>
    </button>
  );
}

/** Real-run mode only (`?runner=api`): the tester code, typed once and kept on this device. */
function TesterCode() {
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const c = loadTestCode();
    setCode(c);
    setSaved(Boolean(c));
  }, []);
  return (
    <form
      className="mt-4 rounded-xl bg-white/70 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        saveTestCode(code);
        setSaved(Boolean(code.trim()));
      }}
    >
      <label htmlFor="tester-code" className="block text-sm font-semibold">
        Tester code for real runs
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="tester-code"
          type="password"
          autoComplete="off"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setSaved(false);
          }}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-ink/20 bg-white px-3 text-base"
        />
        <button type="submit" className="btn-secondary shrink-0 text-sm">
          Save
        </button>
      </div>
      <p aria-live="polite" className="mt-1 text-xs text-ink/70">
        {saved ? "Saved on this device." : "Real runs use paid model credits, so they need a code."}
      </p>
    </form>
  );
}
