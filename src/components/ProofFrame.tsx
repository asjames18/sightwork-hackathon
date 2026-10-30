"use client";

import { useRef, type CSSProperties } from "react";
import type { Box, PlanFrame } from "@/lib/types";

/**
 * A proof frame with an optional normalized (0-1000) box drawn on top.
 * The image keeps its own aspect ratio (phone walkthroughs are usually portrait),
 * so the box always lines up with what SAM saw. Tall frames are capped in height
 * and centered on black.
 *
 * `outlineUnavailable`: the outline step (SAM) did not run for this plan, so a frame without a
 * box says so instead of looking broken, and a box that is there (from the plan step, not SAM) is drawn
 * dashed so it reads as a rough highlight. A missing frame shows a quiet placeholder.
 *
 * When the frame's pixel size is known (bundled examples), the frame box is sized up front from its aspect
 * ratio (same 60vh / 45vh caps), so nothing below it jumps when the image arrives. `priority` loads it
 * eagerly at high priority, for the frame near the top of the plan.
 *
 * Tapping the photo opens it full size in a modal dialog (same outline, caption and time), so a
 * judge or crew lead can check the proof on a phone. Esc, the close button or a tap outside closes
 * it, and focus returns to the photo.
 */
function OutlineBox({ box, dashed }: { box: Box; dashed: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute rounded-md border-[3px] border-accent shadow-[0_0_0_2px_rgba(0,0,0,.35)] ${dashed ? "border-dashed" : ""}`}
      style={{
        left: `${box[0] / 10}%`,
        top: `${box[1] / 10}%`,
        width: `${(box[2] - box[0]) / 10}%`,
        height: `${(box[3] - box[1]) / 10}%`,
      }}
    />
  );
}

export function ProofFrame({
  frame,
  box,
  caption,
  outlineUnavailable = false,
  priority = false,
  frameOnlyLabel = "Frame only, outlines off this run",
}: {
  frame: PlanFrame | undefined;
  box?: Box;
  caption?: string;
  outlineUnavailable?: boolean;
  priority?: boolean;
  /** Badge on a frame with no box when outlines are unavailable. Real runs say outlines were off this run (as "Made with" does); samples say just "Frame only". */
  frameOnlyLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  if (!frame)
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-ink/20 bg-ink/5 px-4 text-center text-sm text-ink/70">
        Proof frame not available for this problem
      </div>
    );
  const sized = Boolean(frame.width && frame.height);
  const label = caption ?? `Frame at ${frame.tSec} s`;
  return (
    <figure className="overflow-hidden rounded-xl bg-black">
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className={`group block cursor-zoom-in focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-accent ${
          sized
            ? "relative mx-auto w-[min(100%,calc(60vh*var(--ar)))] lg:w-[min(100%,calc(45vh*var(--ar)))]"
            : "relative mx-auto w-fit max-w-full"
        }`}
        style={sized ? ({ "--ar": String(frame.width! / frame.height!) } as CSSProperties) : undefined}
      >
        <span className="sr-only">See full size: </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.url}
          alt={label}
          width={frame.width}
          height={frame.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          className={sized ? "block h-auto w-full" : "block h-auto max-h-[60vh] w-auto max-w-full lg:max-h-[45vh]"}
        />
        {box && <OutlineBox box={box} dashed={outlineUnavailable} />}
        {!box && outlineUnavailable && (
          <span className="absolute right-2 top-2 whitespace-nowrap rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
            {frameOnlyLabel}
          </span>
        )}
        <span
          aria-hidden
          className="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white/90 backdrop-blur-sm transition group-hover:bg-black/80 print:hidden"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" />
          </svg>
        </span>
      </button>
      <figcaption className="flex justify-between gap-2 bg-ink px-3 py-1.5 text-sm text-white/85">
        <span className="truncate">{caption ?? "Proof frame"}</span>
        <span className="shrink-0 tabular-nums">{frame.tSec.toFixed(1)} s</span>
      </figcaption>
      <dialog
        ref={dialogRef}
        aria-label={`Proof photo: ${label}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto max-h-[100dvh] max-w-[100vw] overflow-visible bg-transparent p-3 backdrop:bg-black/85 sm:p-6"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-ink shadow focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
              Close
            </button>
          </div>
          <div
            className={
              sized
                ? "relative w-[min(calc(100vw-1.5rem),calc((100dvh-8rem)*var(--ar)))] sm:w-[min(calc(100vw-3rem),calc((100dvh-9rem)*var(--ar)))]"
                : "relative w-fit"
            }
            style={sized ? ({ "--ar": String(frame.width! / frame.height!) } as CSSProperties) : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.url}
              alt={label}
              width={frame.width}
              height={frame.height}
              loading="lazy"
              decoding="async"
              className={
                sized
                  ? "block h-auto w-full rounded-lg"
                  : "block h-auto max-h-[calc(100dvh-8rem)] w-auto max-w-[calc(100vw-1.5rem)] rounded-lg sm:max-w-[calc(100vw-3rem)]"
              }
            />
            {box && <OutlineBox box={box} dashed={outlineUnavailable} />}
          </div>
          <p className="flex w-full justify-between gap-3 text-sm text-white/90">
            <span>{caption ?? "Proof frame"}</span>
            <span className="shrink-0 tabular-nums">{frame.tSec.toFixed(1)} s</span>
          </p>
        </div>
      </dialog>
    </figure>
  );
}
