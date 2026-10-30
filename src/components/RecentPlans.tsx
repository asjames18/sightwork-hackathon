"use client";

import { useState, useSyncExternalStore } from "react";
import {
  listRecentPlans,
  listRecentPlansOnServer,
  openRecentPlan,
  recentWhen,
  removeRecentPlan,
  subscribeRecentPlans,
  type RecentEntry,
} from "@/lib/client/recentPlans";
import type { SavedPlan } from "@/lib/client/lastPlan";

const problemCount = (n: number) => (n === 0 ? "No problems found" : n === 1 ? "1 problem" : `${n} problems`);

/**
 * "Your recent plans": the last few real runs kept on this device. Shown from two plans up, since
 * one plan is already the "Open my last plan" button. Each row reopens its plan; Remove drops it.
 */
export function RecentPlans({ onOpen }: { onOpen: (saved: SavedPlan) => void }) {
  const list = useSyncExternalStore(subscribeRecentPlans, listRecentPlans, listRecentPlansOnServer);
  const [gone, setGone] = useState<string | null>(null);
  if (list.length < 2) return null;

  const open = (e: RecentEntry) => {
    setGone(null);
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
      <ul className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/10">
        {list.map((e) => {
          const details = [e.region, recentWhen(e.savedAt), problemCount(e.problems)].filter(Boolean).join(" · ");
          return (
            <li key={e.id} className="flex items-center gap-2 pr-2">
              <button
                type="button"
                onClick={() => open(e)}
                className="group flex min-h-14 min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <span className="truncate font-bold leading-snug group-hover:underline">{e.spaceName}</span>
                <span className="text-sm text-ink/70">{details}</span>
              </button>
              <button
                type="button"
                onClick={() => void removeRecentPlan(e.id)}
                aria-label={`Remove ${e.spaceName}, ${recentWhen(e.savedAt)}, from this device`}
                className="btn-tertiary min-h-11 shrink-0 px-3 text-sm"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      {gone && (
        <p role="status" className="mt-2 text-sm text-ink/70">
          {gone}
        </p>
      )}
    </section>
  );
}
