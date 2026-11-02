"use client";

import { useEffect, useRef, useState } from "react";
import { clearedLine, restoredTicks, undoClearLabel, type TickNoun } from "@/lib/client/clearTicks";

/**
 * "Clear ticks" for a checklist, with an Undo that puts the same ticks back, so one mis-tap on a phone
 * doesn't wipe a crew's progress. Focus moves to Undo after a clear and back to Clear ticks after Undo.
 * Undo stays on offer until something is ticked again.
 */
export function ClearTicksButton({
  ticked,
  noun,
  onChange,
}: {
  ticked: readonly number[];
  noun: TickNoun;
  onChange: (next: number[]) => void;
}) {
  const [cleared, setCleared] = useState<number[] | null>(null);
  const [refocus, setRefocus] = useState(false);
  const undoRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (cleared) undoRef.current?.focus();
  }, [cleared]);
  useEffect(() => {
    if (refocus && ticked.length > 0) {
      clearRef.current?.focus();
      setRefocus(false);
    }
  }, [refocus, ticked.length]);
  // A new tick after a clear starts fresh, so Undo goes away.
  useEffect(() => {
    if (cleared && ticked.length > 0 && !refocus) setCleared(null);
  }, [cleared, ticked.length, refocus]);

  if (cleared) {
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="clear-ticks-undo">
        <span role="status" className="text-sm text-ink/70">
          {clearedLine(cleared.length, noun)}
        </span>
        <button
          ref={undoRef}
          type="button"
          onClick={() => {
            const back = restoredTicks(cleared, ticked);
            setRefocus(true);
            setCleared(null);
            onChange(back);
          }}
          aria-label={undoClearLabel(cleared.length, noun)}
          className="btn-tertiary min-h-11 px-3 text-sm"
        >
          Undo
        </button>
      </span>
    );
  }
  if (ticked.length === 0) return null;
  return (
    <button
      ref={clearRef}
      type="button"
      onClick={() => {
        setCleared([...ticked]);
        onChange([]);
      }}
      className="btn-tertiary text-sm"
    >
      Clear ticks
    </button>
  );
}
