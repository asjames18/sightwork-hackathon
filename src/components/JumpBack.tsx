"use client";

import { useEffect, useRef, useState } from "react";
import { isJumpHref, jumpBackLabel, jumpBackState } from "@/lib/client/jumpBack";

type Origin = { y: number; label: string; link: HTMLAnchorElement };

/**
 * Floating "Back to step N" button. After a tap on an in-plan link to a problem or a step, it returns the reader to
 * where they were and puts keyboard focus back on the link they tapped. It hides once used, or once they scroll back.
 */
export function JumpBack() {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const away = useRef(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a");
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = link.getAttribute("href");
      if (!isJumpHref(href) || !document.getElementById(href!.slice(1))) return;
      if (link.closest("[data-jump-back]")) return;
      const card = link.closest('[id^="problem-"], [id^="step-"]');
      away.current = false;
      setOrigin({ y: window.scrollY, label: jumpBackLabel(card?.id), link });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!origin) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = jumpBackState({ away: away.current }, window.scrollY, origin.y, window.innerHeight);
      away.current = next.away;
      if (!next.show) setOrigin(null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [origin]);

  function onBack() {
    if (!origin) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: origin.y, behavior: reduce ? "auto" : "smooth" });
    if (origin.link.isConnected) origin.link.focus({ preventScroll: true });
    setOrigin(null);
  }

  if (!origin) return null;
  return (
    <button
      type="button"
      onClick={onBack}
      data-testid="jump-back"
      data-jump-back
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-[calc(1rem+env(safe-area-inset-left))] z-20 inline-flex min-h-11 max-w-[calc(100vw-11rem)] items-center gap-1.5 rounded-full border border-ink/15 bg-white/95 px-4 text-sm font-semibold text-ink shadow-lg backdrop-blur hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark print:hidden"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 5 3.5 9.5 8 14M4 9.5h8.5a4 4 0 0 1 0 8H11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="truncate">{origin.label}</span>
    </button>
  );
}
