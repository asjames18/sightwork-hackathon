import type { WorkStep } from "@/lib/types";
import { PrintOpenDetails } from "@/components/PrintOpenDetails";
import { beforeStartNotes, beforeStartSummary } from "@/lib/client/beforeStart";
import { stepsLabel } from "@/lib/client/crewSummary";
import { stepAnchor } from "@/lib/client/stepLinks";

/**
 * One closed box above the work steps that gathers the plan's small heads-up chips (permit, shut off first,
 * old paint or plaster, up high, fumes, dust, drying, weather) into a single read, each with the steps it
 * applies to as links. It opens itself for printing so the saved plan carries it. Nothing when no step has one.
 */
export function BeforeStart({ steps }: { steps: readonly WorkStep[] }) {
  const notes = beforeStartNotes(steps);
  if (notes.length === 0) return null;
  return (
    <PrintOpenDetails className="mb-3 rounded-2xl border border-ink/10 bg-white px-4 py-1 sm:px-5" data-testid="before-start">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark [&::-webkit-details-marker]:hidden">
        <span>Before anyone starts</span>
        <span className="text-sm font-medium text-ink/75" data-testid="before-start-count">
          {beforeStartSummary(notes)}
        </span>
      </summary>
      <ul className="divide-y divide-ink/10 pb-2">
        {notes.map((n) => (
          <li key={n.key} className="py-2" data-testid="before-start-note">
            <p className="font-semibold">
              {n.label} <span className="font-normal text-ink/75">({stepsLabel(n.steps).toLowerCase()})</span>
            </p>
            <p className="text-sm text-ink/75">{n.hint}</p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm print:hidden">
              {n.steps.map((s) => (
                <a key={s} href={`#${stepAnchor(s)}`} className="inline-flex min-h-11 items-center font-medium text-accent-dark underline underline-offset-2">
                  Go to step {s}
                </a>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </PrintOpenDetails>
  );
}
