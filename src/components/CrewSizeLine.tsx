"use client";

import { useState } from "react";
import { MAX_CREW_SIZE, clampCrewSize, crewSizeLine } from "@/lib/client/crewSummary";

/**
 * "If this many people share the work": a small stepper under the crew summary that turns the total hours into
 * hours each, so a leader can see how many people a day takes. Not kept anywhere; it is only a way to read the total.
 * Hidden in print.
 */
export function CrewSizeLine({ total, partial }: { total: [number, number] | null; partial: boolean }) {
  const [people, setPeople] = useState(2);
  const line = crewSizeLine(total, partial, people);
  if (!line) return null;
  const step = "inline-flex size-11 items-center justify-center rounded-full border border-ink/20 bg-white text-lg font-bold text-ink hover:border-ink/40 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark";
  return (
    <div className="-mt-1 mb-4 flex flex-wrap px-1 items-center gap-x-3 gap-y-1 print:hidden" data-testid="crew-size">
      <span id="crew-size-label" className="text-sm font-semibold">If people share it evenly</span>
      <span role="group" aria-labelledby="crew-size-label" className="inline-flex items-center gap-1">
        <button type="button" className={step} aria-label="One fewer person" disabled={people <= 1} onClick={() => setPeople((p) => clampCrewSize(p - 1))} data-testid="crew-size-less">
          <span aria-hidden="true">−</span>
        </button>
        <span className="min-w-8 text-center text-base font-bold tabular-nums" data-testid="crew-size-count">{people}</span>
        <button type="button" className={step} aria-label="One more person" disabled={people >= MAX_CREW_SIZE} onClick={() => setPeople((p) => clampCrewSize(p + 1))} data-testid="crew-size-more">
          <span aria-hidden="true">+</span>
        </button>
      </span>
      <p role="status" aria-live="polite" className="text-sm text-ink/75" data-testid="crew-size-line">
        {line} Steps that wait on each other will take longer.
      </p>
    </div>
  );
}
