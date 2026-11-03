import type { WorkPlan } from "@/lib/types";
import { afterPictureNote } from "@/lib/client/afterPictureNote";

/** A quiet note on a real plan that finished without its after picture, with a way to film again. */
export function AfterPictureNote({ plan, onFilmAgain }: { plan: WorkPlan; onFilmAgain?: () => void }) {
  const text = afterPictureNote(plan);
  if (!text) return null;
  return (
    <div
      data-testid="after-picture-note"
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
