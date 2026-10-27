"use client";

import { useState } from "react";

/** Drag to compare the real frame (before) with the AI concept (after). */
export function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50);
  return (
    <figure>
      <div className="overflow-hidden rounded-xl bg-black">
        <div className="relative mx-auto w-fit max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={after} alt="After (AI concept)" className="block h-auto max-h-[60vh] w-auto max-w-full" />
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={before} alt="Before (from your video)" className="block h-full w-full object-cover" />
          </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${pos}%` }} />
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Before</span>
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">After</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after"
        className="mt-2 h-11 w-full cursor-pointer accent-[var(--color-accent)]"
      />
      <figcaption className="text-xs text-ink/60">{label}</figcaption>
    </figure>
  );
}
