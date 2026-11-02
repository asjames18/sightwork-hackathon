"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  listRecentPlans,
  listRecentPlansOnServer,
  openRecentPlan,
  recentWhen,
  removeRecentPlanWithUndo,
  restoreRecentPlan,
  subscribeRecentPlans,
  type RecentEntry,
  type RemovedRecent,
} from "@/lib/client/recentPlans";
import type { SavedPlan } from "@/lib/client/lastPlan";

const problemCount = (n: number) => (n === 0 ? "No problems found" : n === 1 ? "1 problem" : `${n} problems`);

/**
 * "Your recent plans": the last few real runs kept on this device. Shown from two plans up, since
 * one plan is already the "Open my last plan" button. Each row reopens its plan; Remove drops it,
 * with an Undo that puts the row and its saved copy back (kept until the next tap on the list).
 */
export function RecentPlans({ onOpen }: { onOpen: (saved: SavedPlan) => void }) {
  const list = useSyncExternalStore(subscribeRecentPlans, listRecentPlans, listRecentPlansOnServer);
  const [gone, setGone] = useState<string | null>(null);
  const [removed, setRemoved] = useState<RemovedRecent | null>(null);
  const [removing, setRemoving] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Keyboard and screen reader users keep their place: focus moves to Undo after a remove, and back
  // to the restored row after Undo.
  useEffect(() => {
    if (removed) undoRef.current?.focus();
  }, [removed]);
  useEffect(() => {
    if (!focusId) return;
    listRef.current?.querySelector<HTMLButtonElement>(`[data-recent-id="${CSS.escape(focusId)}"]`)?.focus();
    setFocusId(null);
  }, [focusId, list]);

  // While Undo is on offer the list stays up, even if one row is left.
  if (list.length < 2 && !((removed || removing) && list.length > 0)) return null;

  const remove = (e: RecentEntry) => {
    setGone(null);
    setRemoved(null);
    setRemoving(true);
    void removeRecentPlanWithUndo(e.id).then((r) => {
      setRemoved(r);
      setRemoving(false);
    });
  };

  const undo = () => {
    const r = removed;
    setRemoved(null);
    if (!r) return;
    void restoreRecentPlan(r).then((ok) => {
      if (ok) setFocusId(r.entry.id);
      else setGone("That plan couldn't be put back on this device.");
    });
  };

  const open = (e: RecentEntry) => {
    setGone(null);
    setRemoved(null);
    void openRecentPlan(e.id).then((saved) => {
      if (saved) onOpen(saved);
      else setGone("That plan is no longer saved on this device, so it was taken off the list.");
    });
  };

  return (
    <section aria-labelledby="recent-heading" className="mt-6">
      <h2 id="recent-heading" className="text-lg font-extrabold">
        Your recent plans
      </h2>
      <p className="mt-1 text-sm text-ink/70">Kept on this device only. The last {list.length} real runs, newest first.</p>
      <ul ref={listRef} className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/10">
        {list.map((e) => {
          const details = [e.region, recentWhen(e.savedAt), problemCount(e.problems)].filter(Boolean).join(" · ");
          return (
            <li key={e.id} className="flex items-center gap-2 pr-2">
              <button
                type="button"
                onClick={() => open(e)}
                data-recent-id={e.id}
                className="group flex min-h-14 min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <span className="truncate font-bold leading-snug group-hover:underline">{e.spaceName}</span>
                <span className="text-sm text-ink/70">{details}</span>
              </button>
              <button
                type="button"
                onClick={() => remove(e)}
                aria-label={`Remove ${e.spaceName}, ${recentWhen(e.savedAt)}, from this device`}
                className="btn-tertiary min-h-11 shrink-0 px-3 text-sm"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      {removed && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="status" className="min-w-0 text-sm text-ink/70">
            Removed {removed.entry.spaceName}, {recentWhen(removed.entry.savedAt)}.
          </p>
          <button
            ref={undoRef}
            type="button"
            onClick={undo}
            aria-label={`Undo: put ${removed.entry.spaceName} back on the list`}
            className="btn-tertiary min-h-11 shrink-0 px-3 text-sm"
          >
            Undo
          </button>
        </div>
      )}
      {gone && (
        <p role="status" className="mt-2 text-sm text-ink/70">
          {gone}
        </p>
      )}
    </section>
  );
}
