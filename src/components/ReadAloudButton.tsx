"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import { canReadAloud, readAloudProgress, readAloudStatus, speakPlanParts } from "@/lib/client/speakPlan";

/**
 * Reads the plan aloud with the browser's own speech voice (nothing leaves the device), one short piece at a
 * time. A second press stops it. Hidden where the browser can't speak, and never in print.
 */
export function ReadAloudButton({ plan }: { plan: WorkPlan }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "reading" | "stopped">("idle");
  // Which spoken piece is being read now (1-based) and how many there are, for the progress line.
  const [progress, setProgress] = useState({ part: 0, total: 0 });
  // Bumped on every start and stop, so a late "ended" from a cancelled run can't flip the button back.
  const run = useRef(0);

  useEffect(() => {
    setSupported(canReadAloud(window as unknown as Parameters<typeof canReadAloud>[0]));
    const stop = () => {
      run.current++;
      window.speechSynthesis?.cancel();
    };
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, []);

  if (!supported) return null;

  function stop() {
    run.current++;
    window.speechSynthesis.cancel();
    setState("stopped");
  }

  function start() {
    const mine = ++run.current;
    const synth = window.speechSynthesis;
    synth.cancel();
    const parts = speakPlanParts(plan);
    setState("reading");
    setProgress({ part: 0, total: parts.length });
    parts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      const last = i === parts.length - 1;
      u.onstart = () => run.current === mine && setProgress({ part: i + 1, total: parts.length });
      if (last) u.onend = () => run.current === mine && setState("idle");
      u.onerror = (e) => {
        // "canceled" and "interrupted" are our own stop; anything else ends the run quietly.
        if (run.current === mine && e.error !== "canceled" && e.error !== "interrupted") setState("idle");
      };
      synth.speak(u);
    });
  }

  const reading = state === "reading";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      <button
        type="button"
        onClick={reading ? stop : start}
        aria-pressed={reading}
        data-testid="read-aloud"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {reading ? (
            <rect x="5" y="5" width="10" height="10" rx="1.5" />
          ) : (
            <>
              <path d="M3 8v4h3l4 3V5L6 8H3z" />
              <path d="M13 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10" />
            </>
          )}
        </svg>
        {reading ? "Stop reading" : "Read it to me"}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-ink/70">
        {readAloudStatus(state)}
      </p>
      {reading && readAloudProgress(progress.part, progress.total) ? (
        <p aria-hidden="true" data-testid="read-aloud-progress" className="flex items-center gap-2 text-sm text-ink/70">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ink/10">
            <span className="block h-full rounded-full bg-accent-dark" style={{ width: `${Math.round((progress.part / progress.total) * 100)}%` }} />
          </span>
          {readAloudProgress(progress.part, progress.total)}
        </p>
      ) : null}
    </div>
  );
}
