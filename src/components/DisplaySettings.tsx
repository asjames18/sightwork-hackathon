"use client";

import type { ReactNode } from "react";

/**
 * One collapsed "Display and voice" control for the plan header: reading pace, text size and contrast live
 * inside it, so the top of the plan shows only Send and Read it to me. The pace button is placed into
 * `hostRef` by the read-aloud control. Never in print.
 */
export function DisplaySettings({ hostRef, children }: { hostRef: (el: HTMLDivElement | null) => void; children: ReactNode }) {
  return (
    <details className="mt-4 w-full print:hidden" data-testid="display-settings">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 6h14M3 14h14" />
          <circle cx="7" cy="6" r="2" fill="white" />
          <circle cx="13" cy="14" r="2" fill="white" />
        </svg>
        Display and voice
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div ref={hostRef} className="contents" />
        {children}
      </div>
    </details>
  );
}
