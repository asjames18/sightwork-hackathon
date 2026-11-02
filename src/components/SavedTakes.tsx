"use client";

import { useState, useSyncExternalStore } from "react";
import {
  listSavedTakes,
  listSavedTakesOnServer,
  openSavedTake,
  removeSavedTake,
  subscribeSavedTakes,
  takeSize,
  takeWhen,
  type TakeEntry,
} from "@/lib/client/savedTakes";
import { formatDuration } from "@/lib/client/duration";
import { SaveVideoButton } from "./SaveVideoButton";

/**
 * "Your saved takes": the last few walkthroughs recorded in SightWork's camera, kept on this device.
 * Each row can be saved to the phone's Photos (share sheet) or downloaded, used for a new plan, or removed.
 * Hidden in print.
 */
export function SavedTakes({ onUse }: { onUse?: (file: File) => void }) {
  const list = useSyncExternalStore(subscribeSavedTakes, listSavedTakes, listSavedTakesOnServer);
  const [gone, setGone] = useState<string | null>(null);
  if (list.length === 0) return gone ? <p role="status" className="mt-2 text-sm text-ink/70 print:hidden">{gone}</p> : null;

  const open = async (e: TakeEntry) => {
    const file = await openSavedTake(e.id);
    if (!file) setGone("That take is no longer saved on this device, so it was taken off the list.");
    return file;
  };

  return (
    <section aria-labelledby="takes-heading" className="mt-6 print:hidden" data-testid="saved-takes">
      <h2 id="takes-heading" className="text-lg font-extrabold">
        Your saved takes
      </h2>
      <p className="mt-1 text-sm text-ink/70">Videos you recorded here, kept on this device only.{list.length > 1 ? ` The last ${list.length}, newest first.` : ""}</p>
      <ul className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/10">
        {list.map((e) => {
          const when = takeWhen(e.savedAt);
          const details = [when, e.durationSec ? formatDuration(e.durationSec) : null, takeSize(e.size)].filter(Boolean).join(" · ");
          return (
            <li key={e.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold leading-snug">{e.name}</p>
                <p className="text-sm text-ink/70">{details}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <SaveVideoButton
                  getFile={() => open(e)}
                  ariaLabel={`Save video ${e.name}`}
                  className="btn-secondary min-h-11 px-3 text-sm"
                />
                {onUse && (
                  <button
                    type="button"
                    onClick={() => void open(e).then((file) => file && onUse(file))}
                    aria-label={`Use ${e.name} for a new plan`}
                    className="btn-tertiary min-h-11 shrink-0 px-3 text-sm"
                  >
                    Use
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setGone(null);
                    void removeSavedTake(e.id);
                  }}
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
      {gone && (
        <p role="status" className="mt-2 text-sm text-ink/70">
          {gone}
        </p>
      )}
    </section>
  );
}
