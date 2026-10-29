import { AFTER_IMAGE_LABEL, masksAvailable, type Issue, type PlanFrame, type WorkPlan } from "@/lib/types";
import { ProofFrame } from "./ProofFrame";
import { BeforeAfter } from "./BeforeAfter";

/** Severity shows as the card's left border plus a quiet label, so the one accent chip ("You didn't mention this") stands alone. */
const SEVERITY_BORDER: Record<Issue["severity"], string> = {
  high: "border-l-red-600",
  medium: "border-l-amber-500",
  low: "border-l-ink/25",
};
const SEVERITY_LABEL: Record<Issue["severity"], string> = { high: "High", medium: "Medium", low: "Low" };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const range = (r: [number, number], unit = "") => (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`);

function Section({ title, children, id, className }: { title: string; children: React.ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={className ? `mt-10 ${className}` : "mt-10"}>
      <h2 className="mb-3 text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-white p-4 text-sm text-ink/70">{children}</p>;
}

/** A walkthrough with no speech: the said-vs-seen framing doesn't apply. */
export function isNarrated(plan: WorkPlan): boolean {
  return Boolean(plan.transcript?.trim()) || (plan.transcriptTurns?.length ?? 0) > 0;
}

function SaidBadge({ issue, narrated }: { issue: Issue; narrated: boolean }) {
  if (!narrated)
    return <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold">Seen on camera</span>;
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

/** Where the after picture goes when there isn't one yet: the real frame, dimmed, with a plain note. */
function AfterSlot({ frame }: { frame: PlanFrame | undefined }) {
  return (
    <figure className="relative overflow-hidden rounded-2xl bg-ink">
      {frame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={frame.url} alt="" aria-hidden className="block aspect-video w-full object-cover opacity-30 blur-[2px]" />
      ) : (
        <div aria-hidden className="aspect-video w-full bg-gradient-to-br from-ink to-ink/70" />
      )}
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center text-white">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">Coming soon</span>
        <span className="text-lg font-bold sm:text-xl">After picture</span>
        <span className="max-w-sm text-sm text-white/75">
          An AI concept of the finished space will show here. The plan above is complete without it.
        </span>
      </figcaption>
    </figure>
  );
}

/** Small "how this plan was made" line, so the agent trace is visible on the result too. */
function MadeWith({ plan, masks }: { plan: WorkPlan; masks: boolean }) {
  const planEngine = plan.meta?.planProvider === "baseten" ? "Muse Spark Open (Meta open weights, on Baseten)" : "Muse Spark";
  const rows: [string, string][] = [
    ["Plan", planEngine],
    ["Outlines", masks ? "SAM 3.1" : "Off this run"],
    ["After picture", plan.afterImageUrl ? "Muse Image" : "Off this run"],
  ];
  return (
    <footer className="mt-12 border-t border-ink/10 pt-4 text-sm text-ink/70">
      <p className="font-semibold uppercase tracking-wide">How this plan was made</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt>{k}</dt>
            <dd className="text-ink/75">{v}</dd>
          </div>
        ))}
      </dl>
    </footer>
  );
}

export function PlanView({
  plan,
  videoName,
  onMakeYourOwn,
}: {
  plan: WorkPlan;
  videoName: string | null;
  /** Example banner's "Make your own": back to the empty upload stage. */
  onMakeYourOwn?: () => void;
}) {
  const frames = plan.frames ?? [];
  const narrated = isNarrated(plan);
  const unmentioned = narrated ? plan.issues.filter((i) => i.unmentioned) : [];
  const hero = plan.heroFrameIndex !== undefined ? frames[plan.heroFrameIndex] : undefined;
  const masks = masksAvailable(plan);
  // Without SAM, any box on a proof frame came from the plan step itself, so call it a rough highlight.
  const roughBoxes = !masks && plan.issues.some((i) => i.proofFrames?.[0]?.box);
  const slotFrame = hero ?? frames[plan.issues[0]?.frameIndex ?? 0] ?? frames[0];

  return (
    <article>
      {plan.meta?.isExample && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between print:block">
          <p>
            <strong>Example plan.</strong> Made-up data for a church sanctuary stage
            {videoName ? `, shown because real analysis isn't connected yet (your video "${videoName}" was not sent anywhere)` : ""}.
          </p>
          {onMakeYourOwn && (
            <button
              type="button"
              onClick={onMakeYourOwn}
              className="min-h-11 shrink-0 self-start rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900 sm:self-auto print:hidden"
            >
              Make your own
            </button>
          )}
        </div>
      )}

      <h1 className="text-3xl font-extrabold leading-tight break-words sm:text-4xl">{plan.spaceName}</h1>
      <p className="mt-1 text-sm text-ink/70">{plan.generatedFrom}</p>

      {unmentioned.length > 0 && (
        <a href="#problems" className="mt-5 block rounded-2xl bg-ink p-5 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50">
          <p className="text-4xl font-extrabold text-accent">{unmentioned.length}</p>
          <p className="text-lg font-semibold">
            problem{unmentioned.length === 1 ? "" : "s"} you didn&apos;t mention
          </p>
          <p className="mt-1 text-sm text-white/70">{unmentioned.map((i) => i.title).join(" · ")}</p>
        </a>
      )}

      {!narrated && plan.issues.length > 0 && (
        <a href="#problems" className="mt-5 block rounded-2xl bg-ink p-5 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50">
          <p className="text-4xl font-extrabold text-accent">{plan.issues.length}</p>
          <p className="text-lg font-semibold">problem{plan.issues.length === 1 ? "" : "s"} found on camera</p>
          <p className="mt-1 text-sm text-white/70">{plan.issues.map((i) => i.title).join(" · ")}</p>
        </a>
      )}

      {!narrated && (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm text-ink/70">
          No narration in this video, so everything here comes from what the camera saw. Talk through what you&apos;re worried
          about next time and SightWork will compare what you said with what it sees.
        </p>
      )}

      {narrated && plan.transcriptSummary && (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm">
          <span className="font-semibold">What you asked for: </span>
          {plan.transcriptSummary}
        </p>
      )}

      {/* The after picture is the wow moment, so it sits right under the summary, but only when it exists. */}
      {plan.afterImageUrl && hero && (
        <Section title="Before and after" className="mt-6!">
          <BeforeAfter before={hero.url} after={plan.afterImageUrl} label={plan.afterImageLabel ?? AFTER_IMAGE_LABEL} />
        </Section>
      )}

      {plan.afterImageUrl && !hero && (
        <Section title="After the work" className="mt-6!">
          <figure className="overflow-hidden rounded-xl bg-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={plan.afterImageUrl} alt="AI concept of the finished space" className="block aspect-[4/3] max-h-[70vh] w-full object-cover" />
            <figcaption className="bg-ink px-3 py-1.5 text-sm text-white/80">{plan.afterImageLabel ?? AFTER_IMAGE_LABEL}</figcaption>
          </figure>
        </Section>
      )}

      <Section title="Problems, worst first" id="problems">
        {plan.issues.length === 0 && <Empty>No problems found in the frames we looked at. Walk it in person before you sign off.</Empty>}
        {plan.issues.length > 0 && !masks && (
          <p className="mb-4 rounded-xl border border-ink/10 bg-white/70 px-4 py-3 text-sm text-ink/70">
            {roughBoxes
              ? "Exact outlines are off for this plan, so the dashed boxes are rough highlights from the plan step. Each problem still shows the frame it was found in."
              : "Outlines on the proof frames are off for this plan. Each problem still shows the frame it was found in."}
          </p>
        )}
        <ol className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          {plan.issues.map((issue) => {
            const proof = issue.proofFrames?.[0];
            return (
              <li key={issue.rank} className={`min-w-0 rounded-2xl border-l-4 bg-white p-4 shadow-sm ${SEVERITY_BORDER[issue.severity]}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold tabular-nums">#{issue.rank}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">{SEVERITY_LABEL[issue.severity]} priority</span>
                  <SaidBadge issue={issue} narrated={narrated} />
                </div>
                <h3 className="mt-2 text-lg font-bold leading-snug">{issue.title}</h3>
                <p className="mt-1 text-sm text-ink/75">{issue.detail}</p>
                {issue.status !== "mentioned_not_seen" && (
                  <div className="mt-3">
                    <ProofFrame frame={frames[proof?.frameIndex ?? issue.frameIndex]} box={proof?.box} caption={proof?.caption} outlineUnavailable={!masks} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Section>

      {narrated && plan.saidVsSeen && plan.saidVsSeen.length > 0 && (
        <Section title="What you said vs. what we saw">
          <ul className="divide-y divide-ink/10 rounded-2xl bg-white">
            {plan.saidVsSeen.map((row, i) => (
              <li key={i} className="grid gap-1 p-3 text-sm sm:grid-cols-2 sm:gap-3">
                <div>
                  <span className="mr-1 text-xs font-semibold uppercase text-ink/70 sm:hidden">Said</span>
                  {row.said ? <>&ldquo;{row.said.quote}&rdquo; <span className="text-ink/65">({row.said.atSec.toFixed(0)} s)</span></> : <span className="text-ink/65">Not mentioned</span>}
                </div>
                <div className={row.status === "unmentioned" ? "font-semibold text-accent-dark" : ""}>
                  <span className="mr-1 text-xs font-semibold uppercase text-ink/70 sm:hidden">Seen</span>
                  {row.seen ? row.seen.summary : <span className="text-ink/65">Not visible in the video</span>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="What's there">
        {plan.inventory.length === 0 && <Empty>Nothing was counted in this video.</Empty>}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {plan.inventory.map((item) => (
            <li key={item.label} className="min-w-0 rounded-2xl bg-white p-4">
              <p className="text-3xl font-extrabold tabular-nums">{item.range ? range(item.range) : item.count}</p>
              <p className="font-medium break-words">{item.label}</p>
              {item.zone && !item.label.toLowerCase().includes(item.zone.toLowerCase()) && (
                <p className="text-sm text-ink/70">{item.zone}</p>
              )}
            </li>
          ))}
        </ul>
        {plan.inventory.length > 0 && (
          <p className="mt-2 text-sm text-ink/70">{masks ? "Approximate, counted from the video." : "Approximate, estimated from the frames. Exact counts come with outlines."}</p>
        )}
      </Section>

      <Section title="Do the work in this order">
        {plan.workOrder.length === 0 && <Empty>No work steps, since nothing needs fixing.</Empty>}
        <ol className="space-y-3">
          {plan.workOrder.map((step) => (
            <li key={step.order} className="flex gap-3 rounded-2xl bg-white p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-bold text-white">{step.order}</span>
              <div className="min-w-0">
                <p className="font-bold">{step.title}</p>
                <p className="text-sm text-ink/75">{step.detail}</p>
                <p className="mt-1 text-sm text-ink/70">
                  {[step.trade, step.hours && `${range(step.hours, " h")}`, step.dependsOn && `after step ${step.dependsOn}`, step.fixes?.length && `fixes #${step.fixes.join(", #")}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Materials">
        {plan.materials.length === 0 && <Empty>No materials needed.</Empty>}
        <ul className={plan.materials.length ? "divide-y divide-ink/10 rounded-2xl bg-white" : "hidden"}>
          {plan.materials.map((m) => (
            <li key={m.item} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium break-words">{m.item}</p>
                <p className="text-sm text-ink/70">
                  {[m.forIssues?.length && `for #${m.forIssues.join(", #")}`, m.note].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{m.qty}</p>
                {m.unitCost && <p className="text-sm text-ink/70">{usd(m.unitCost[0])}–{usd(m.unitCost[1])} each</p>}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {!plan.costRange && plan.materials.length > 0 && (
        <Section title="What it might cost">
          <Empty>
            {plan.meta?.skipped?.cost
              ? "The cost range couldn\u2019t be worked out this run. The materials and work steps above are complete; try again to price them for your area."
              : "No cost range yet. Add your city or region and we\u2019ll price the materials and labor for your area."}
          </Empty>
        </Section>
      )}

      {plan.costRange && (
        <Section title="What it might cost">
          <div className="rounded-2xl bg-white p-5">
            <p className="text-3xl font-extrabold tabular-nums">
              <span className="whitespace-nowrap">{usd(plan.costRange.low)}</span> –{" "}
              <span className="whitespace-nowrap">{usd(plan.costRange.high)}</span>
            </p>
            <p className="mt-1 text-sm text-ink/70">{plan.costRange.label}</p>
            <details className="group mt-3 border-t border-ink/10 pt-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink/60 motion-safe:transition-transform group-open:rotate-90">
                  <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                How we got this
              </summary>
              <p className="mt-2 text-sm">
                Region: {plan.costRange.region} · Labor: {plan.costRange.laborBasis}
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-ink/70">
                {plan.costRange.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              {plan.costRange.sources && plan.costRange.sources.length > 0 && (
                <p className="mt-3 text-sm text-ink/70">
                  Prices from{" "}
                  {plan.costRange.sources.map((src, i) => (
                    <span key={src.url}>
                      {i > 0 && ", "}
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-words rounded-sm underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {src.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </details>
          </div>
        </Section>
      )}

      {/* The "coming soon" placeholder is screen-only: a saved PDF shows just the finished plan. */}
      {!plan.afterImageUrl && plan.workOrder.length > 0 && (
        <Section title="After the work" className="print:hidden">
          <AfterSlot frame={slotFrame} />
        </Section>
      )}

      <MadeWith plan={plan} masks={masks} />
    </article>
  );
}
