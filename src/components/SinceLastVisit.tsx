"use client";

import type { WorkPlan } from "@/lib/types";
import { compareSummary, type CompareRow } from "@/lib/client/planCompare";
import { usePlanComparison } from "@/lib/client/usePlanComparison";

const TIER_LABEL: Record<CompareRow["tier"], string> = { urgent: "Fix now", soon: "Fix soon", later: "Can wait" };

function Group({ title, rows, tone, testId }: { title: string; rows: CompareRow[]; tone: string; testId: string }) {
  if (rows.length === 0) return null;
  return (
    <div data-testid={testId}>
      <h3 className={`text-sm font-bold ${tone}`}>
        {title} ({rows.length})
      </h3>
      <ul className="mt-1 space-y-1 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2 break-words">
            <span className="min-w-0">{r.title}</span>
            <span className="text-xs text-ink/65">{TIER_LABEL[r.tier]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * On a real plan, compares it with the previous saved walkthrough of the same space and place on this
 * device. Shows nothing on samples, when there's no earlier run, or when its saved copy can't be read.
 */
export function SinceLastVisit({ plan }: { plan: WorkPlan }) {
  const loaded = usePlanComparison(plan);
  if (!loaded) return null;
  const c = loaded.comparison;
  const when = loaded.when;
  return (
    <section
      aria-labelledby="since-last-heading"
      data-testid="since-last"
      className="mt-6 rounded-2xl border border-ink/10 bg-white p-4 sm:p-5"
    >
      <h2 id="since-last-heading" className="text-lg font-bold">
        Since your last walkthrough
      </h2>
      <p className="mt-1 text-sm text-ink/75">
        {compareSummary(c)}, compared with the walkthrough of this space{when ? ` on ${when}` : ""}.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Group title="No longer seen" rows={c.gone} tone="text-emerald-800" testId="since-last-gone" />
        <Group title="Still there" rows={c.stillThere} tone="text-amber-900" testId="since-last-still" />
        <Group title="New this time" rows={c.newOnes} tone="text-sky-800" testId="since-last-new" />
      </div>
      <p className="mt-3 text-xs text-ink/65">
        Problems are matched by what they are and where they are, so check the photos before you count one as fixed. A
        problem can also drop out because the camera didn&apos;t pass it this time.
      </p>
    </section>
  );
}
