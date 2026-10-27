import type { Box, PlanFrame } from "@/lib/types";

/**
 * A proof frame with an optional normalized (0-1000) box drawn on top.
 * The image keeps its own aspect ratio (phone walkthroughs are usually portrait),
 * so the box always lines up with what SAM saw. Tall frames are capped in height
 * and centered on black.
 *
 * `outlineUnavailable`: the outline step (SAM) did not run for this plan, so a frame without a
 * box says so instead of looking broken. A missing frame shows a quiet placeholder.
 */
export function ProofFrame({
  frame,
  box,
  caption,
  outlineUnavailable = false,
}: {
  frame: PlanFrame | undefined;
  box?: Box;
  caption?: string;
  outlineUnavailable?: boolean;
}) {
  if (!frame)
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-ink/20 bg-ink/5 px-4 text-center text-sm text-ink/50">
        Proof frame not available for this problem
      </div>
    );
  return (
    <figure className="overflow-hidden rounded-xl bg-black">
      <div className="relative mx-auto w-fit max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame.url}
          alt={caption ?? `Frame at ${frame.tSec} s`}
          loading="lazy"
          className="block h-auto max-h-[60vh] w-auto max-w-full"
        />
        {box && (
          <span
            aria-hidden
            className="absolute rounded-md border-[3px] border-accent shadow-[0_0_0_2px_rgba(0,0,0,.35)]"
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
            Frame only, outline coming soon
          </span>
        )}
      </div>
      <figcaption className="flex justify-between gap-2 bg-ink px-3 py-1.5 text-xs text-white/80">
        <span className="truncate">{caption ?? "Proof frame"}</span>
        <span className="shrink-0 tabular-nums">{frame.tSec.toFixed(1)} s</span>
      </figcaption>
    </figure>
  );
}
