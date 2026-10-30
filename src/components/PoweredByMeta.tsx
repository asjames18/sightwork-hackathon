import type { WorkPlan } from "@/lib/types";
import { creditsSummary, metaCredits, type CreditStatus } from "@/lib/metaCredits";

const STATUS_LABEL: Record<CreditStatus, string> = {
  ran: "Ran",
  off: "Off this run",
  not_needed: "Nothing to do",
  sample: "In a real run",
  precomputed: "Precomputed",
};
const STATUS_CLASS: Record<CreditStatus, string> = {
  ran: "bg-safe-dark text-white",
  off: "bg-ink/10 text-ink/75",
  not_needed: "bg-ink/10 text-ink/75",
  sample: "bg-ink/10 text-ink/75",
  precomputed: "bg-ink/10 text-ink/75",
};

/** Small Meta infinity-style mark, drawn inline (no logo file). Decorative. */
function MetaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 20" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
      <path d="M4 15c0-6 3-11 6.5-11S16 9 18 12s4.5 6 7.5 6S32 15 32 11 30 4 26 4s-6 4-8 8-4.5 6-7.5 6S4 18 4 15Z" />
    </svg>
  );
}

/**
 * "Powered by Meta" panel at the end of the plan: every pipeline step, the Meta model that does it, where it ran,
 * and whether it ran for this plan. Samples say no model ran. Printed with the PDF.
 */
export function PoweredByMeta({ plan, sample }: { plan: WorkPlan; sample?: boolean }) {
  const credits = metaCredits(plan, { sample });
  return (
    <section aria-labelledby="powered-heading" className="mt-12 rounded-2xl border border-ink/10 bg-white p-5 sm:p-6 md:mt-16 print:break-inside-avoid">
      <div className="flex items-center gap-2 text-[#0866ff]">
        <MetaMark className="h-4 w-7" />
        <h2 id="powered-heading" className="text-sm font-bold uppercase tracking-wide">
          Powered by Meta AI
        </h2>
      </div>
      <p className="mt-2 text-base font-semibold" data-testid="credits-summary">
        {creditsSummary(credits)}
      </p>
      <ol className="mt-4 divide-y divide-ink/10">
        {credits.map((c) => (
          <li key={c.step} className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <span className="text-sm font-semibold text-ink/70">{c.step}</span>
            <span className="min-w-0">
              <span className="block font-bold">{c.model}</span>
              <span className="block text-sm text-ink/70">
                {c.job}. {c.host}.{c.note ? ` ${c.note}.` : ""}
              </span>
            </span>
            <span className={`justify-self-start rounded-full px-2.5 py-0.5 text-xs font-semibold sm:justify-self-end ${STATUS_CLASS[c.status]}`}>
              {STATUS_LABEL[c.status]}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
