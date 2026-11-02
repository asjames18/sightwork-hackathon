"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  listSavedTakes,
  listSavedTakesOnServer,
  openSavedTake,
  removeSavedTakeWithUndo,
  restoreSavedTake,
  subscribeSavedTakes,
  takeSize,
  takeWhen,
  type RemovedTake,
  type TakeEntry,
} from "@/lib/client/savedTakes";
import { formatDuration } from "@/lib/client/duration";
import { listRecentPlans, listRecentPlansOnServer, openRecentPlan, subscribeRecentPlans } from "@/lib/client/recentPlans";
import type { SavedPlan } from "@/lib/client/lastPlan";
import { planForTake, takePlanLine } from "@/lib/client/takePlan";
import { SaveVideoButton } from "./SaveVideoButton";
import { TakeThumb } from "./TakeThumb";

/**
 * "Your saved takes": the last few walkthroughs recorded in SightWork's camera, kept on this device.
 * Each row can be saved to the phone's Photos (share sheet) or downloaded, used for a new plan, or removed.
 * Each row leads with a small still from the take's own video so back-to-back takes are easy to tell apart.
 * A take that already made a plan (still on the recent plans list) says so and can open that plan.
 * Remove offers an Undo that puts the take and its video back (until the next tap on the list), so a
 * walkthrough is never lost to one mis-tap. Hidden in print.
 */
export function SavedTakes({ onUse, onOpenPlan }: { onUse?: (file: File) => void; onOpenPlan?: (saved: SavedPlan) => void }) {
  const list = useSyncExternalStore(subscribeSavedTakes, listSavedTakes, listSavedTakesOnServer);
  const recents = useSyncExternalStore(subscribeRecentPlans, listRecentPlans, listRecentPlansOnServer);
  const [gone, setGone] = useState<string | null>(null);
  const [removed, setRemoved] = useState<RemovedTake | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Keyboard and screen reader users keep their place: focus moves to Undo after a remove, and back
  // to the restored take's Save video button after Undo.
  useEffect(() => {
    if (removed) undoRef.current?.focus();
  }, [removed]);
  useEffect(() => {
    if (!focusId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-take-id="${CSS.escape(focusId)}"] button`)?.focus();
    setFocusId(null);
  }, [focusId, list]);

  const remove = (e: TakeEntry) => {
    setGone(null);
    setRemoved(null);
    void removeSavedTakeWithUndo(e.id).then(setRemoved);
  };

  const undo = () => {
    const r = removed;
    setRemoved(null);
    if (!r) return;
    void restoreSavedTake(r).then((ok) => {
      if (ok) setFocusId(r.entry.id);
      else setGone("That take couldn't be put back on this device.");
    });
  };

  const undoRow = removed && (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="take-undo">
      <p role="status" className="min-w-0 break-words text-sm text-ink/70">
        Removed {removed.entry.name}, {takeWhen(removed.entry.savedAt)}.
      </p>
      <button
        ref={undoRef}
        type="button"
        onClick={undo}
        aria-label={`Undo: put ${removed.entry.name} back on this device`}
        className="btn-tertiary min-h-11 shrink-0 px-3 text-sm"
      >
        Undo
      </button>
    </div>
  );

  if (list.length === 0)
    return undoRow || gone ? (
      <section aria-label="Your saved takes" className="mt-6 print:hidden" data-testid="saved-takes">
        {undoRow}
        {gone && <p role="status" className="mt-2 text-sm text-ink/70">{gone}</p>}
      </section>
    ) : null;

  const open = async (e: TakeEntry) => {
    const file = await openSavedTake(e.id);
    if (!file) setGone("That take is no longer saved on this device, so it was taken off the list.");
    return file;
  };

  const openPlan = (id: string) => {
    setGone(null);
    setRemoved(null);
    void openRecentPlan(id).then((saved) => {
      if (saved) onOpenPlan?.(saved);
      else setGone("That plan is no longer saved on this device, so it was taken off the list.");
    });
  };

  return (
    <section aria-labelledby="takes-heading" className="mt-6 print:hidden" data-testid="saved-takes">
      <h2 id="takes-heading" className="text-lg font-extrabold">
        Your saved takes
      </h2>
      <p className="mt-1 text-sm text-ink/70">Videos you recorded here, kept on this device only.{list.length > 1 ? ` The last ${list.length}, newest first.` : ""}</p>
      <ul ref={listRef} className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/10">
        {list.map((e) => {
          const when = takeWhen(e.savedAt);
          const details = [when, e.durationSec ? formatDuration(e.durationSec) : null, takeSize(e.size)].filter(Boolean).join(" · ");
          const made = planForTake(recents, e);
          return (
            <li key={e.id} data-take-id={e.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <TakeThumb id={e.id} durationSec={e.durationSec} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold leading-snug">{e.name}</p>
                  <p className="text-sm text-ink/70">{details}</p>
                  {made && (
                    <p data-testid="take-plan" className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-ink">
                      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-accent-dark" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                      </svg>
                      <span className="min-w-0 break-words">{takePlanLine(made)}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <SaveVideoButton
                  getFile={() => open(e)}
                  ariaLabel={`Save video ${e.name}`}
                  className="btn-secondary min-h-11 px-3 text-sm"
                />
                {made && onOpenPlan && (
                  <button
                    type="button"
                    onClick={() => openPlan(made.id)}
                    aria-label={`Open plan made from ${e.name}`}
                    className="btn-secondary min-h-11 shrink-0 px-3 text-sm"
                  >
                    Open plan
                  </button>
                )}
                {onUse && (
                  <button
                    type="button"
                    onClick={() => {
                      setRemoved(null);
                      void open(e).then((file) => file && onUse(file));
                    }}
                    aria-label={`Use ${e.name} for a new plan`}
                    className="btn-tertiary min-h-11 shrink-0 px-3 text-sm"
                  >
                    Use
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(e)}
                  aria-label={`Remove ${e.name}, ${when}, from this device`}
                  className="btn-tertiary min-h-11 shrink-0 px-3 text-sm"
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {undoRow}
      {gone && (
        <p role="status" className="mt-2 text-sm text-ink/70">
          {gone}
        </p>
      )}
    </section>
  );
}
