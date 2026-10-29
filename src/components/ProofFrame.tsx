import type { CSSProperties } from "react";
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
 */
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
  if (!frame)
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-ink/20 bg-ink/5 px-4 text-center text-sm text-ink/70">
        Proof frame not available for this problem
      </div>
    );
  const sized = Boolean(frame.width && frame.height);
  return (
    <figure className="overflow-hidden rounded-xl bg-black">
      <div
        className={
          sized
            ? "relative mx-auto w-[min(100%,calc(60vh*var(--ar)))] lg:w-[min(100%,calc(45vh*var(--ar)))]"
            : "relative mx-auto w-fit max-w-full"
        }
        style={sized ? ({ "--ar": String(frame.width! / frame.height!) } as CSSProperties) : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.url}
          alt={caption ?? `Frame at ${frame.tSec} s`}
          width={frame.width}
          height={frame.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          className={sized ? "block h-auto w-full" : "block h-auto max-h-[60vh] w-auto max-w-full lg:max-h-[45vh]"}
        />
        {box && (
          <span
            aria-hidden
            className={`absolute rounded-md border-[3px] border-accent shadow-[0_0_0_2px_rgba(0,0,0,.35)] ${outlineUnavailable ? "border-dashed" : ""}`}
            style={{
              left: `${box[0] / 10}%`,
              top: `${box[1] / 10}%`,
              width: `${(box[2] - box[0]) / 10}%`,
              height: `${(box[3] - box[1]) / 10}%`,
            }}
          />
        )}
        {!box && outlineUnavailable && (
          <span className="absolute right-2 top-2 whitespace-nowrap rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
            {frameOnlyLabel}
          </span>
        )}
      </div>
      <figcaption className="flex justify-between gap-2 bg-ink px-3 py-1.5 text-sm text-white/85">
        <span className="truncate">{caption ?? "Proof frame"}</span>
        <span className="shrink-0 tabular-nums">{frame.tSec.toFixed(1)} s</span>
      </figcaption>
    </figure>
  );
}
