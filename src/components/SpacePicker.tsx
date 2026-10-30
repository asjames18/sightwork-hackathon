"use client";

import { useEffect, useId, useState } from "react";
import { loadSpaceChoice, saveSpaceChoice, SPACE_NAME_MAX, SPACE_TYPES, type SpaceChoice } from "@/lib/client/spaceType";

/**
 * "What kind of space?" on the video card (richer findings, item 3). The pick and the optional name are saved
 * on this device as they change; the run reads them when it starts (selectRunner → savedSpaceRequestFields),
 * so the plan gets the checks for that kind of space and a real title instead of "Walkthrough".
 */
export function SpacePicker() {
  const id = useId();
  const [choice, setChoice] = useState<SpaceChoice>({ typeId: "", name: "" });
  // Read after mount so the server render and the first client render match.
  useEffect(() => setChoice(loadSpaceChoice()), []);
  const update = (next: SpaceChoice) => {
    setChoice(next);
    saveSpaceChoice(next);
  };
  return (
    <fieldset className="mx-4 mb-3 rounded-xl bg-ink/[0.03] p-3 ring-1 ring-ink/10" data-testid="space-picker">
      <legend className="sr-only">About this space</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${id}-type`} className="block text-sm font-semibold">
            What kind of space?
          </label>
          <select
            id={`${id}-type`}
            value={choice.typeId}
            onChange={(e) => update({ ...choice, typeId: e.target.value })}
            className="mt-1 min-h-11 w-full rounded-lg border border-ink/20 bg-white px-3 text-base"
          >
            <option value="">Pick one (optional)</option>
            {SPACE_TYPES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-name`} className="block text-sm font-semibold">
            Name <span className="font-normal text-ink/65">(optional)</span>
          </label>
          <input
            id={`${id}-name`}
            type="text"
            autoComplete="off"
            maxLength={SPACE_NAME_MAX}
            placeholder="e.g. Main sanctuary"
            value={choice.name}
            onChange={(e) => update({ ...choice, name: e.target.value })}
            className="mt-1 min-h-11 w-full rounded-lg border border-ink/20 bg-white px-3 text-base placeholder:text-ink/45"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink/65">Helps SightWork check what matters in this kind of space. Saved on this device.</p>
    </fieldset>
  );
}
