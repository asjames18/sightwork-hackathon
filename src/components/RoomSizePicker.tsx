"use client";

import { useId } from "react";
import { aimText, ROOM_SIZES, type RoomSize } from "@/lib/client/duration";

/**
 * "How big is the space?" (Small, Medium, Large, Extra large). The size sets how long the walkthrough
 * should be: the aim and the cap shown on each option, the recorder's wrap-up hint and automatic stop,
 * and the length check on a picked video all come from ROOM_SIZES in duration.ts. Saved on this device
 * by the upload screen (roomSize.ts).
 */
export function RoomSizePicker({ value, onChange, className = "" }: { value: RoomSize; onChange: (size: RoomSize) => void; className?: string }) {
  const id = useId();
  return (
    <fieldset className={className} data-testid="room-size-picker" aria-describedby={`${id}-hint`}>
      <legend className="text-sm font-semibold">How big is the space?</legend>
      <p id={`${id}-hint`} className="mt-0.5 text-xs text-ink/70">
        Sets how long to film. Bigger spaces get more time.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {ROOM_SIZES.map((r) => {
          const checked = r.size === value;
          return (
            <label
              key={r.size}
              data-size={r.size}
              className={`flex min-h-11 cursor-pointer flex-col rounded-xl border px-3 py-2 text-left transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                checked ? "border-accent-dark bg-accent/10 ring-1 ring-accent-dark" : "border-ink/20 bg-white hover:border-ink/40"
              }`}
            >
              <input
                type="radio"
                name={`${id}-size`}
                value={r.size}
                checked={checked}
                onChange={() => onChange(r.size)}
                className="sr-only"
              />
              <span className="text-sm font-bold">{r.label}</span>
              <span className="text-xs text-ink/70">{r.examples}</span>
              <span className={`mt-1 text-xs font-semibold ${checked ? "text-ink" : "text-ink/75"}`}>{aimText(r)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
