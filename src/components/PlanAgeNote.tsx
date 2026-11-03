"use client";

import { useEffect, useState } from "react";
import { planAgeNote } from "@/lib/client/planAge";

/**
 * A quiet note on a real plan that was made a week or more ago. It reads the clock after the page loads, so
 * a plan that was just made (or one with no saved time) shows nothing and the markup never differs from the server's.
 */
export function PlanAgeNote({ savedAt, onFilmAgain }: { savedAt: string | null | undefined; onFilmAgain?: () => void }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(planAgeNote(savedAt, new Date())?.text ?? null);
  }, [savedAt]);
  if (!text) return null;
  return (
    <div
      data-testid="plan-age-note"
      className="mt-4 flex flex-col gap-3 rounded-xl border border-ink/10 bg-white p-4 text-sm print:hidden sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="min-w-0 text-ink/80">{text}</p>
      {onFilmAgain && (
        <button type="button" onClick={onFilmAgain} className="btn-secondary shrink-0 self-start text-sm sm:self-auto">
          Film it again
        </button>
      )}
    </div>
  );
}
