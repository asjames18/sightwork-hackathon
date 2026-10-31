import { TIER_LABEL, type Tier } from "@/lib/planExtras";
import { problemAnchor } from "@/lib/client/stepLinks";
import { markLabel, markText, walkSummary, walkTimeline } from "@/lib/client/walkTimeline";
import type { Issue, WorkPlan } from "@/lib/types";

// Marker fills with text that passes contrast on each (white on red-700, ink on amber and slate).
const MARK_STYLE: Record<Tier, string> = {
  urgent: "bg-red-700 text-white",
  soon: "bg-amber-400 text-ink",
  later: "bg-slate-300 text-ink",
};

function MicIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
      <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * "Along your walk": one bar the length of the walkthrough, a marker per problem at the second it was seen
 * (ringed when nobody mentioned it) and a mic tick where it was said. Each marker links to its problem card.
 */
export function WalkTimeline({ plan, issues, narrated }: { plan: WorkPlan; issues: Issue[]; narrated: boolean }) {
  const t = walkTimeline(plan, issues, narrated);
  if (!t) return null;
  const tiers = (["urgent", "soon", "later"] as Tier[]).filter((tier) => t.marks.some((m) => m.tier === tier));
  return (
    <figure className="mb-6 rounded-2xl border border-ink/10 bg-white p-4 sm:p-5 break-inside-avoid" data-testid="walk-timeline" aria-labelledby="walk-timeline-heading">
      <h3 id="walk-timeline-heading" className="font-extrabold">
        Along your walk
      </h3>
      <p className="mt-1 text-sm text-ink/70" data-testid="walk-summary">
        {walkSummary(t)}
      </p>
      <div className={`relative mt-5 ${t.said.length > 0 ? "h-16" : "h-12"}`}>
        {/* The walk itself */}
        <div aria-hidden className="absolute inset-x-0 top-[22px] h-1.5 rounded-full bg-ink/10" />
        <ol className="contents" aria-label="Problems in the order they were seen">
          {t.marks.map((m) => (
            <li key={`${m.atSec}-${m.ranks[0]}`} className="absolute top-2 -translate-x-1/2" style={{ left: `${m.pct}%` }}>
              <a
                href={`#${problemAnchor(m.ranks[0])}`}
                aria-label={markLabel(m, TIER_LABEL[m.tier])}
                data-testid="walk-mark"
                className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums shadow-sm outline-offset-2 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-accent-dark ${MARK_STYLE[m.tier]} ${
                  m.unsaid ? "ring-2 ring-ink ring-offset-2 ring-offset-white" : ""
                }`}
              >
                {markText(m)}
              </a>
            </li>
          ))}
        </ol>
        {t.said.map((s) => (
          <span
            key={`said-${s.rank}-${s.atSec}`}
            aria-hidden
            data-testid="walk-said"
            className="absolute top-11 -translate-x-1/2 text-accent-dark"
            style={{ left: `${s.pct}%` }}
          >
            <MicIcon />
          </span>
        ))}
      </div>
      <div className="flex justify-between text-xs text-ink/65 tabular-nums" aria-hidden>
        <span>0 s</span>
        <span>{Math.round(t.lengthSec)} s</span>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink/70">
        {tiers.map((tier) => (
          <span key={tier} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={`h-3 w-3 rounded-full ${MARK_STYLE[tier].split(" ")[0]}`} />
            {TIER_LABEL[tier]}
          </span>
        ))}
        {t.unsaid > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-full ring-2 ring-ink ring-offset-1" />
            Never mentioned
          </span>
        )}
        {t.said.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-ink/70">
            <span className="text-accent-dark">
              <MicIcon />
            </span>
            Where you said it
          </span>
        )}
        <span className="basis-full text-ink/60">Tap a number to jump to that problem.</span>
      </figcaption>
    </figure>
  );
}
