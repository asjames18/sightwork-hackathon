"use client";

import { useEffect, useState } from "react";
import { showBackToTop } from "@/lib/client/backToTop";

/**
 * Floating "Back to top" button for long plans. It shows after the reader scrolls well down, returns to the
 * plan title and moves keyboard focus there so screen reader and keyboard users land in the same place.
 */
export function BackToTop({ targetId }: { targetId: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setShown(showBackToTop(window.scrollY, window.innerHeight));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function onClick() {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    document.getElementById(targetId)?.focus({ preventScroll: true });
  }

  if (!shown) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="back-to-top"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-20 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 bg-white/95 px-4 text-sm font-semibold text-ink shadow-lg backdrop-blur hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark print:hidden"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back to top
    </button>
  );
}
