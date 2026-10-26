import type { Box, PlanFrame } from "@/lib/types";

/** A proof frame with an optional normalized (0-1000) box drawn on top. */
export function ProofFrame({ frame, box, caption }: { frame: PlanFrame | undefined; box?: Box; caption?: string }) {
  if (!frame) return null;
  return (
    <figure className="overflow-hidden rounded-xl bg-black">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frame.url} alt={caption ?? `Frame at ${frame.tSec} s`} className="block aspect-video w-full object-cover" />
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
      </div>
      <figcaption className="flex justify-between gap-2 bg-ink px-3 py-1.5 text-xs text-white/80">
        <span className="truncate">{caption ?? "Proof frame"}</span>
        <span className="shrink-0 tabular-nums">{frame.tSec.toFixed(1)} s</span>
      </figcaption>
    </figure>
  );
}
