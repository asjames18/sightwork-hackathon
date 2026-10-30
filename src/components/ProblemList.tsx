import type { Issue, PlanFrame, PlanReview, WorkPlan } from "@/lib/types";
import { ProofFrame } from "./ProofFrame";
import { verdictFor, verdictKind, supportedScope } from "@/lib/review";
import { boxSource, coverageNote, groupByTier, issueExtras, issueTier, TIER_HINT, TIER_LABEL, type Tier, type WatchItem } from "@/lib/planExtras";
import { checklistRows } from "@/lib/checklist";
import { shareLabel, type CostShare } from "@/lib/costShares";
import { PrintOpenDetails } from "./PrintOpenDetails";

/**
 * The Problems section body (richer findings, items 2, 6 and 7): problems grouped into Fix now / Fix soon /
 * Can wait (from the server's tier, else severity), each card with where it is, what the photo shows, its
 * reviewer state (backed, partly backed, not backed) and its share of the cost. Then the plan's coverage note,
 * "Worth a closer look" (collapsed, lower confidence), and the checklist of areas looked at. Every optional
 * field is read through planExtras/costShares, so today's plans render the same cards as before.
 */

const SEVERITY_BORDER: Record<Issue["severity"], string> = {
  high: "border-l-red-600",
  medium: "border-l-amber-500",
  low: "border-l-ink/25",
};
const SEVERITY_LABEL: Record<Issue["severity"], string> = { high: "High", medium: "Medium", low: "Low" };

/** Same hues as the severity border on each card. */
const TIER_DOT: Record<Tier, string> = { urgent: "bg-red-600", soon: "bg-amber-500", later: "bg-ink/25" };

function SaidBadge({ issue, narrated }: { issue: Issue; narrated: boolean }) {
  if (!narrated) return <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold">Seen on camera</span>;
  if (issue.unmentioned)
    return <span className="rounded-full bg-accent-dark px-2 py-0.5 text-xs font-bold text-white">You didn&apos;t mention this</span>;
  if (issue.status === "mentioned_not_seen")
    return <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold">You said it, check in person</span>;
  return (
    <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold">
      You said it{issue.mention ? ` at ${issue.mention.saidAtSec.toFixed(0)} s` : ""}
    </span>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-ink/60" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17.5s-5-4.3-5-8.5a5 5 0 0 1 10 0c0 4.2-5 8.5-5 8.5Z" />
      <circle cx="10" cy="9" r="1.7" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-ink/60" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  );
}

/** Where it is and what the photo shows, as two quiet lines. Nothing when neither is sent. */
function WhereAndWhat({ area, evidence }: { area?: string; evidence?: string }) {
  if (!area && !evidence) return null;
  return (
    <dl className="mt-2 flex flex-col gap-1 text-sm text-ink/75">
      {area && (
        <div className="flex gap-1.5">
          <PinIcon />
          <dt className="sr-only">Where</dt>
          <dd className="min-w-0">{area}</dd>
        </div>
      )}
      {evidence && (
        <div className="flex gap-1.5">
          <EyeIcon />
          <dt className="sr-only">Photo shows</dt>
          <dd className="min-w-0">
            <span aria-hidden className="font-semibold text-ink/80">Photo shows: </span>
            {evidence}
          </dd>
        </div>
      )}
    </dl>
  );
}

function IssueCard({
  issue,
  frames,
  narrated,
  review,
  masks,
  sample,
  cost,
  titleLevel = 4,
}: {
  titleLevel?: 3 | 4;
  issue: Issue;
  frames: PlanFrame[];
  narrated: boolean;
  review: PlanReview | undefined;
  masks: boolean;
  sample: boolean;
  cost?: CostShare;
}) {
  const proof = issue.proofFrames?.[0];
  const verdict = verdictFor(review, issue);
  const kind = verdictKind(verdict);
  const scope = supportedScope(verdict);
  const { area, evidence } = issueExtras(issue);
  const seen = issue.status !== "mentioned_not_seen";
  return (
    <li
      className={`min-w-0 rounded-2xl border-l-4 bg-white p-4 shadow-sm break-inside-avoid ${SEVERITY_BORDER[issue.severity]} ${
        seen ? "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:items-start md:gap-4" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {cost && (
            <span className="order-last ml-auto hidden text-sm font-semibold text-ink tabular-nums sm:inline" data-testid="issue-cost">
              <span className="font-medium text-ink/65">Share of cost </span>
              {shareLabel(cost)}
            </span>
          )}
          <span className="text-lg font-extrabold tabular-nums">#{issue.rank}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">{SEVERITY_LABEL[issue.severity]} priority</span>
          <SaidBadge issue={issue} narrated={narrated} />
          {kind === "not_shown" && (
            <span className="rounded-full border border-amber-800 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-900">Unverified</span>
          )}
          {kind === "partly" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Partly backed</span>
          )}
        </div>
        {titleLevel === 3 ? (
          <h3 className="mt-2 text-lg font-bold leading-snug">{issue.title}</h3>
        ) : (
          <h4 className="mt-2 text-lg font-bold leading-snug">{issue.title}</h4>
        )}
        {cost && (
          <p className="mt-1 text-sm font-semibold text-ink tabular-nums sm:hidden" aria-hidden>
            <span className="font-medium text-ink/65">Share of cost </span>
            {shareLabel(cost)}
          </p>
        )}
        <p className="mt-1 text-sm text-ink/75">{issue.detail}</p>
        <WhereAndWhat area={area} evidence={evidence} />
        {kind === "not_shown" && verdict?.reason && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-semibold">Not backed by a photo: </span>
            {verdict.reason}
          </p>
        )}
        {kind === "partly" && (scope || verdict?.reason) && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <span className="font-semibold">Partly backed: </span>
            {scope ? `the photos show ${scope.replace(/^(the )?photos? shows? /i, "")}` : verdict?.reason}
            {scope && verdict?.reason ? <span className="mt-0.5 block text-amber-900/80">{verdict.reason}</span> : null}
          </p>
        )}

      </div>
      {seen && (
        <div className="mt-3 min-w-0 md:mt-0">
          <ProofFrame
            frame={frames[proof?.frameIndex ?? issue.frameIndex]}
            box={proof?.box}
            boxSource={boxSource(proof)}
            caption={proof?.caption}
            outlineUnavailable={!masks}
            frameOnlyLabel={sample ? "Frame only" : undefined}
          />
        </div>
      )}
    </li>
  );
}

export function ProblemList({
  plan,
  issues,
  watch,
  narrated,
  review,
  masks,
  sample,
  issueCosts,
}: {
  plan: WorkPlan;
  /** Ranked problems (watch items already taken out). */
  issues: Issue[];
  watch: WatchItem[];
  narrated: boolean;
  review: PlanReview | undefined;
  masks: boolean;
  sample: boolean;
  issueCosts: Map<number, CostShare> | null;
}) {
  const frames = plan.frames ?? [];
  const groups = groupByTier(issues);
  const note = coverageNote(plan);
  // Tier headings only help once there is more than one problem; a single card reads fine alone.
  const showTiers = issues.length > 1;
  const showChecklist = [...issues, ...watch].some((i) => typeof (i as { checklistKey?: unknown }).checklistKey === "string");
  return (
    <>
      {issueCosts && (
        <p className="mb-4 text-sm text-ink/70">Each problem shows its share of the rough cost. Shared supplies are split, and the shares add up to the total.</p>
      )}
      {showTiers ? (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.tier} aria-labelledby={`tier-${g.tier}`}>
              <div className="mb-3 flex items-baseline gap-2">
                <span aria-hidden className={`h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-full ${TIER_DOT[g.tier]}`} />
                <h3 id={`tier-${g.tier}`} className="text-base font-extrabold">
                  {TIER_LABEL[g.tier]} <span className="font-semibold text-ink/60 tabular-nums">· {g.issues.length}</span>
                </h3>
              </div>
              <p className="-mt-2 mb-3 pl-[1.125rem] text-sm text-ink/65">{TIER_HINT[g.tier]}</p>
              <ol className="flex flex-col gap-3">
                {g.issues.map((issue) => (
                  <IssueCard key={issue.rank} issue={issue} frames={frames} narrated={narrated} review={review} masks={masks} sample={sample} cost={issueCosts?.get(issue.rank)} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {issues.map((issue) => (
            <IssueCard key={issue.rank} titleLevel={3} issue={issue} frames={frames} narrated={narrated} review={review} masks={masks} sample={sample} cost={issueCosts?.get(issue.rank)} />
          ))}
        </ol>
      )}

      {note && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-white p-4 text-sm text-ink/70" data-testid="coverage-note">
          <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-ink/60" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 9v4.5M10 6.3v.2" />
          </svg>
          <span>
            <span className="font-semibold text-ink">Why {issues.length === 1 ? "only one problem" : issues.length === 0 ? "no problems" : `only ${issues.length} problems`}: </span>
            {note}
          </span>
        </p>
      )}

      {watch.length > 0 && <WatchList items={watch} frames={frames} masks={masks} sample={sample} />}
      {showChecklist && <Checklist issues={issues} watch={watch} />}
    </>
  );
}

/** "Worth a closer look": lower-confidence finds, collapsed by default, each with its photo. */
function WatchList({ items, frames, masks, sample }: { items: WatchItem[]; frames: PlanFrame[]; masks: boolean; sample: boolean }) {
  return (
    <PrintOpenDetails className="group mt-6 rounded-2xl border border-ink/10 bg-white" data-testid="watch-list">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink/60 motion-safe:transition-transform group-open:rotate-90">
          <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold">
            Worth a closer look
            <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold tabular-nums">{items.length}</span>
          </span>
          <span className="mt-0.5 block text-sm text-ink/65">Lower confidence. Not in the ranked list or the work order; check these in person.</span>
        </span>
      </summary>
      <ul className="flex flex-col gap-3 px-5 pb-5">
        {items.map((w, i) => {
          const proof = w.proofFrames?.[0];
          return (
            <li key={`${w.title}-${i}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_6.5rem] items-start gap-3 rounded-xl bg-ink/[0.03] p-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="min-w-0">
                <p className="font-bold leading-snug">{w.title}</p>
                {w.detail && <p className="mt-0.5 text-sm text-ink/75">{w.detail}</p>}
                <WhereAndWhat area={w.area} evidence={w.evidence} />
                {w.confidence !== undefined && (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink/60">
                    {Math.round(w.confidence * 100)}% sure
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <ProofFrame
                  frame={frames[proof?.frameIndex ?? w.frameIndex]}
                  box={proof?.box}
                  boxSource={boxSource(proof)}
                  caption={proof?.caption ?? "Check this"}
                  outlineUnavailable={!masks}
                  frameOnlyLabel={sample ? "Frame only" : undefined}
                  compact
                />
              </div>
            </li>
          );
        })}
      </ul>
    </PrintOpenDetails>
  );
}

/**
 * The areas the checklist covers. Areas that turned something up are listed first with their counts; the clear
 * ones follow as a compact row of ticks, so a phone screen isn't a wall of "nothing flagged". Shown only when the
 * plan step used the checklist (its problems carry a checklistKey).
 */
function Checklist({ issues, watch }: { issues: Issue[]; watch: WatchItem[] }) {
  const rows = checklistRows(issues as (Issue & { checklistKey?: unknown })[], watch as (WatchItem & { checklistKey?: unknown })[]);
  const hits = rows.filter((r) => r.found + r.watch > 0);
  const clear = rows.filter((r) => r.found + r.watch === 0);
  return (
    <section aria-labelledby="checklist-heading" className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 break-inside-avoid" data-testid="checklist">
      <h3 id="checklist-heading" className="font-extrabold">
        What SightWork checked
      </h3>
      <p className="mt-0.5 text-sm text-ink/65">
        The plan step went through {rows.length} areas in every frame.{" "}
        {hits.length === 0 ? "Nothing was flagged." : `${hits.length} turned something up.`}
      </p>
      {hits.length > 0 && (
        <ul className="mt-3 divide-y divide-ink/10" aria-label="Areas with findings">
          {hits.map((r) => (
            <li key={r.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900">
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M8 4v4.5M8 11.5v.2" /></svg>
                </span>
                <span className="min-w-0 font-semibold">{r.label}</span>
              </span>
              <span className="shrink-0 text-right text-ink/70 tabular-nums">
                {r.found > 0 ? `${r.found} ${r.found === 1 ? "problem" : "problems"}` : null}
                {r.found > 0 && r.watch > 0 ? " · " : null}
                {r.watch > 0 ? `${r.watch} to check` : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {clear.length > 0 && (
        <div className="mt-3 border-t border-ink/10 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Nothing flagged</p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Areas with nothing flagged">
            {clear.map((r) => (
              <li key={r.id} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-safe/10 px-2.5 text-sm text-safe-dark">
                <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Re-exported so PlanView can keep its stat row in step with the tiers. */
export { issueTier };
