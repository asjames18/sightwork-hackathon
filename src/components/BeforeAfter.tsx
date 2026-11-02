"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COMPARE_VIEWS, activeCompareView, clampComparePos, compareValueText } from "@/lib/client/beforeAfter";
import { SWEEP_DELAY_MS, SWEEP_VISIBLE, shouldSweep, sweepDone, sweepPos } from "@/lib/client/compareSweep";

/**
 * Drag to compare the real frame (before) with the AI concept (after).
 * Fills the width; the range input sits over the whole image, so dragging anywhere on it
 * moves the divider, and arrow keys still work. The visible handle is drawn on the image.
 * Before / Compare / After buttons under it show the whole before or after picture in one tap.
 * The first time it comes into view, the divider glides once each way as a hint (not with reduced
 * motion); any touch, click, key or focus on it stops the hint and puts the divider back in the middle.
 */
export function BeforeAfter({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(50);
  const active = activeCompareView(pos);
  const sweep = useCompareSweep(setPos);
  return (
    <figure onPointerDownCapture={sweep.stop} onKeyDownCapture={sweep.stop} onFocusCapture={sweep.stop}>
      <div ref={sweep.ref} className="relative overflow-hidden rounded-xl bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="After (AI concept)" fetchPriority="high" className="block aspect-[4/3] max-h-[70vh] w-full object-cover" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt="Before (from your video)" fetchPriority="high" className="block h-full w-full object-cover" />
        </div>
        {/* Each corner label only shows while some of its picture is on screen. */}
        {pos > 0 && (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-sm font-medium text-white">
            Before
          </span>
        )}
        {pos < 100 && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-sm font-medium text-white">
            After
          </span>
        )}
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(clampComparePos(Number(e.target.value)))}
          aria-label="Compare before and after"
          aria-valuetext={compareValueText(pos)}
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
      <div role="group" aria-label="Show" className="mt-3 flex w-full print:hidden! rounded-full bg-ink/5 p-1 sm:inline-flex sm:w-auto">
        {COMPARE_VIEWS.map((v) => {
          const on = active === v.id;
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPos(v.pos)}
              className={`min-h-11 flex-1 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/60 sm:flex-none ${
                on ? "bg-ink text-white shadow" : "text-ink/80 hover:bg-ink/10"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>
      <figcaption className="mt-2 text-sm text-ink/70">{label}</figcaption>
    </figure>
  );
}

/**
 * Plays the one-time sweep hint when the slider is mostly on screen. Returns the element to watch and
 * a stop function for any user interaction, which also returns the divider to the middle mid-hint.
 */
function useCompareSweep(setPos: (pos: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const played = useRef(false);
  const running = useRef(false);
  const frame = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stop = useCallback(() => {
    touched.current = true;
    clearTimeout(timer.current);
    cancelAnimationFrame(frame.current);
    if (running.current) {
      running.current = false;
      setPos(50);
    }
  }, [setPos]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!shouldSweep({ reducedMotion, alreadyPlayed: played.current, touched: touched.current })) return;
    const play = () => {
      if (!shouldSweep({ reducedMotion, alreadyPlayed: played.current, touched: touched.current })) return;
      played.current = true;
      running.current = true;
      let start: number | null = null;
      const tick = (now: number) => {
        if (!running.current) return;
        if (start === null) start = now;
        const elapsed = now - start;
        setPos(sweepPos(elapsed));
        if (sweepDone(elapsed)) {
          running.current = false;
          return;
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.some((e) => e.isIntersecting && e.intersectionRatio >= SWEEP_VISIBLE);
        clearTimeout(timer.current);
        if (seen) {
          timer.current = setTimeout(() => {
            io.disconnect();
            play();
          }, SWEEP_DELAY_MS);
        }
      },
      { threshold: [0, SWEEP_VISIBLE, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer.current);
      cancelAnimationFrame(frame.current);
      running.current = false;
    };
  }, [setPos]);

  return { ref, stop };
}
