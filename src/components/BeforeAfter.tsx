"use client";

import { useState } from "react";

/**
 * Drag to compare the real frame (before) with the AI concept (after).
 * Fills the width; the range input sits over the whole image, so dragging anywhere on it
 * moves the divider, and arrow keys still work. The visible handle is drawn on the image.
 */
export function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50);
  return (
    <figure>
      <div className="relative overflow-hidden rounded-xl bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="After (AI concept)" fetchPriority="high" className="block aspect-[4/3] max-h-[70vh] w-full object-cover" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt="Before (from your video)" fetchPriority="high" className="block h-full w-full object-cover" />
        </div>
        <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-sm font-medium text-white">
          Before
        </span>
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-sm font-medium text-white">
          After
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Compare before and after"
          aria-valuetext={`${pos}% before`}
          className="peer absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent opacity-0"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]"
          style={{ left: `${pos}%` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-lg ring-accent/60 peer-focus-visible:ring-4"
          style={{ left: `${pos}%` }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>
      <figcaption className="mt-2 text-sm text-ink/70">{label}</figcaption>
    </figure>
  );
}
