import { AFTER_IMAGE_LABEL, masksAvailable, type Issue, type PlanFrame, type WorkPlan } from "@/lib/types";
import { ProofFrame } from "./ProofFrame";
import { BeforeAfter } from "./BeforeAfter";
import type { Example } from "@/lib/examples";

/** Severity shows as the card's left border plus a quiet label, so the one accent chip ("You didn't mention this") stands alone. */
const SEVERITY_BORDER: Record<Issue["severity"], string> = {
  high: "border-l-red-600",
  medium: "border-l-amber-500",
  low: "border-l-ink/25",
};
const SEVERITY_LABEL: Record<Issue["severity"], string> = { high: "High", medium: "Medium", low: "Low" };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const range = (r: [number, number], unit = "") => (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`);

function Section({ title, children, id, className }: { title: React.ReactNode; children: React.ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={className ? `mt-12 scroll-mt-32 md:mt-16 ${className}` : "mt-12 scroll-mt-32 md:mt-16"}>
      <h2 className="mb-6 text-xl font-extrabold">{title}</h2>
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

/**
 * Quiet metadata row under the plan title, e.g. "78 s · 12 frames · narrated". The plan step writes generatedFrom as
 * "Walkthrough video, N frames, D s, narrated"; read the numbers from it, and fall back to the raw line if it doesn't parse.
 */
export function planMetaParts(plan: WorkPlan): string[] | null {
  const text = plan.generatedFrom ?? "";
  const secs = text.match(/(\d+(?:\.\d+)?)\s*s\b/);
  const frameCount = text.match(/(\d+)\s*frames?\b/);
  if (!secs && !frameCount) return null;
  const parts: string[] = [];
  if (secs) parts.push(`${Math.round(Number(secs[1]))} s`);
  const n = frameCount ? Number(frameCount[1]) : (plan.frames?.length ?? 0);
  if (n > 0) parts.push(`${n} ${n === 1 ? "frame" : "frames"}`);
  parts.push(isNarrated(plan) ? "narrated" : "no narration");
  return parts;
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
  example,
  onMakeYourOwn,
}: {
  plan: WorkPlan;
  videoName: string | null;
  /** Set when this plan was opened from the examples list: drives the "Real run" or "Sample" banner. */
  example?: Example;
  /** Example banner's "Make your own": back to the empty upload stage. */
  onMakeYourOwn?: () => void;
}) {
  const frames = plan.frames ?? [];
  const narrated = isNarrated(plan);
  const metaParts = planMetaParts(plan);
  const unmentioned = narrated ? plan.issues.filter((i) => i.unmentioned) : [];
  const hero = plan.heroFrameIndex !== undefined ? frames[plan.heroFrameIndex] : undefined;
  const masks = masksAvailable(plan);
  // Without SAM, any box on a proof frame came from the plan step itself, so call it a rough highlight.
  const roughBoxes = !masks && plan.issues.some((i) => i.proofFrames?.[0]?.box);
  const slotFrame = hero ?? frames[plan.issues[0]?.frameIndex ?? 0] ?? frames[0];
  // Hero proof frame for the top of the plan when there's no after picture: the plan's hero frame, else the worst
  // problem's proof frame. It borrows that problem's box and caption only when it is the same frame.
  const topIssue = plan.issues.find((i) => i.status !== "mentioned_not_seen");
  const topIssueProof = topIssue?.proofFrames?.[0];
  const topIssueIndex = topIssueProof?.frameIndex ?? topIssue?.frameIndex;
  const topProofIndex = plan.heroFrameIndex !== undefined && hero ? plan.heroFrameIndex : topIssueIndex;
  const topProof =
    topProofIndex !== undefined && frames[topProofIndex]
      ? topProofIndex === topIssueIndex && topIssue
        ? { frame: frames[topProofIndex], box: topIssueProof?.box, caption: topIssueProof?.caption ?? topIssue.title }
        : { frame: frames[topProofIndex], box: undefined, caption: "Your walkthrough" }
      : undefined;
  // Summary stat row: never show a slot that can be empty, so "not mentioned" needs narration and cost needs a costRange.
  const stats: { label: string; value: string; accent?: boolean; small?: boolean }[] = [
    { label: narrated ? "Problems found" : "Problems found on camera", value: String(plan.issues.length) },
    ...(narrated ? [{ label: "You didn't mention", value: String(unmentioned.length), accent: unmentioned.length > 0 }] : []),
    ...(plan.workOrder.length > 0 ? [{ label: "Work steps", value: String(plan.workOrder.length) }] : []),
    ...(plan.costRange ? [{ label: "Rough cost", value: `${usd(plan.costRange.low)}–${usd(plan.costRange.high)}`, small: true }] : []),
  ];

  // Sticky section chips: one per section that actually renders, so no chip points at nothing.
  const showSaid = narrated && !!plan.saidVsSeen && plan.saidVsSeen.length > 0;
  const chips: { href: string; label: string }[] = [
    { href: "#problems", label: "Problems" },
    ...(showSaid ? [{ href: "#said-vs-saw", label: "Said vs saw" }] : []),
    { href: "#counts", label: "Counts" },
    { href: "#steps", label: "Steps" },
    { href: "#materials", label: "Materials" },
    ...(plan.costRange ? [{ href: "#cost", label: "Cost" }] : []),
  ];

  return (
    <article>
      {example ? (
        <ExampleBanner example={example} videoName={videoName} onMakeYourOwn={onMakeYourOwn} />
      ) : (
        plan.meta?.isExample && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between print:block">
            <p>
              <strong>Example plan.</strong>{" "}
              Sample data written by hand, not a real run
              {videoName ? `, shown because real analysis isn't on in this preview (your video "${videoName}" was not sent anywhere)` : ""}.
            </p>
            {onMakeYourOwn && (
              <button
                type="button"
                onClick={onMakeYourOwn}
                className="btn-primary shrink-0 self-start text-sm sm:self-auto print:hidden"
              >
                Make your own
              </button>
            )}
          </div>
        )
      )}

      <h1 className="text-3xl font-extrabold leading-tight break-words sm:text-4xl">{plan.spaceName}</h1>
      {metaParts ? (
        <p className="mt-1 text-sm text-ink/70">
          <span className="sr-only">Walkthrough video: </span>
          {metaParts.join(" · ")}
        </p>
      ) : (
        plan.generatedFrom && <p className="mt-1 text-sm text-ink/70">{plan.generatedFrom}</p>
      )}

      {plan.issues.length > 0 && (
        <a
          href="#problems"
          className="mt-5 block rounded-2xl bg-ink p-5 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50 sm:p-6"
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-10">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="text-sm font-semibold text-white/80">{s.label}</dt>
                <dd className={`font-extrabold leading-tight break-words ${s.small ? "text-2xl" : "text-4xl"} ${s.accent ? "text-accent" : "text-white"}`}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-white/80">
            {unmentioned.length > 0 && <span className="font-semibold text-white">Not mentioned: </span>}
            {(unmentioned.length > 0 ? unmentioned : plan.issues).map((i) => i.title).join(" · ")}
          </p>
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

      {/* No after picture: lead with the hero proof frame instead, so the top never shows an empty slot. */}
      {!plan.afterImageUrl && topProof && (
        <Section title="From your video" className="mt-6!">
          <ProofFrame frame={topProof.frame} box={topProof.box} caption={topProof.caption} outlineUnavailable={!masks} priority />
        </Section>
      )}

      <nav
        aria-label="Plan sections"
        className="sticky top-[calc(3.5rem+1px+env(safe-area-inset-top))] z-10 -mx-4 mt-6 border-b border-ink/10 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sm:-mx-6 print:hidden"
      >
        <ul className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <li key={c.href} className="shrink-0">
              <a
                href={c.href}
                className="inline-flex min-h-11 items-center rounded-full border border-ink/15 bg-white px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
              >
                {c.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section title="Problems, worst first" id="problems">
        {plan.issues.length === 0 && <Empty>No problems found in the frames we looked at. Walk it in person before you sign off.</Empty>}
        {plan.issues.length > 0 && !masks && (
          <p className="mb-4 rounded-xl border border-ink/10 bg-white/70 px-4 py-3 text-sm text-ink/70">
            {roughBoxes
              ? "Exact outlines are off for this plan, so the dashed boxes are rough highlights from the plan step. Each problem still shows the frame it was found in."
              : "Outlines on the proof frames are off for this plan. Each problem still shows the frame it was found in."}
          </p>
        )}
        <ol className="flex flex-col gap-3">
          {plan.issues.map((issue) => {
            const proof = issue.proofFrames?.[0];
            return (
              <li
                key={issue.rank}
                className={`min-w-0 rounded-2xl border-l-4 bg-white p-4 shadow-sm ${SEVERITY_BORDER[issue.severity]} ${
                  issue.status !== "mentioned_not_seen" ? "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:items-start md:gap-4" : ""
                }`}
              >
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold tabular-nums">#{issue.rank}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">{SEVERITY_LABEL[issue.severity]} priority</span>
                  <SaidBadge issue={issue} narrated={narrated} />
                </div>
                <h3 className="mt-2 text-lg font-bold leading-snug">{issue.title}</h3>
                <p className="mt-1 text-sm text-ink/75">{issue.detail}</p>
                </div>
                {issue.status !== "mentioned_not_seen" && (
                  <div className="mt-3 min-w-0 md:mt-0">
                    <ProofFrame frame={frames[proof?.frameIndex ?? issue.frameIndex]} box={proof?.box} caption={proof?.caption} outlineUnavailable={!masks} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Section>

      {narrated && plan.saidVsSeen && plan.saidVsSeen.length > 0 && (
        <Section title="What you said vs. what we saw" id="said-vs-saw">
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

      <Section
        title={<>What&apos;s there{plan.inventory.length > 0 && <>{" "}<span className="ml-1 text-sm font-medium text-ink/70">approximate</span></>}</>}
        id="counts"
      >
        {plan.inventory.length === 0 && <Empty>Nothing was counted in this video.</Empty>}
        {/* Tiles grow to fill their row, so an odd last row (3 + 2, or 2 + 1 on phones) has no empty slot; four tiles stay 2 + 2. */}
        <ul className="flex flex-wrap gap-3 print:break-inside-avoid">
          {plan.inventory.map((item) => (
            <li key={item.label} className={`min-w-0 grow basis-[calc(50%-0.375rem)] rounded-2xl bg-white p-4 ${plan.inventory.length === 4 ? "" : "sm:basis-[calc(33.333%-0.5rem)]"}`}>
              <p className="text-3xl font-extrabold tabular-nums">{item.range ? range(item.range) : item.count}</p>
              <p className="font-medium break-words">{item.label}</p>
              {item.zone && !item.label.toLowerCase().includes(item.zone.toLowerCase()) && (
                <p className="text-sm text-ink/70">{item.zone}</p>
              )}
            </li>
          ))}
        </ul>
        {plan.inventory.length > 0 && (
          <p className="mt-2 text-sm text-ink/70">{masks ? "Counted from the video, from what the camera saw." : "Estimated from the frames, from what the camera saw. Exact counts come with outlines."}</p>
        )}
      </Section>

      <Section title="Do the work in this order" id="steps">
        {plan.workOrder.length === 0 && <Empty>No work steps, since nothing needs fixing.</Empty>}
        {plan.workOrder.length > 0 && (
          <ol className="rounded-2xl bg-white px-4 py-2 sm:px-5">
            {plan.workOrder.map((step, i) => {
              const last = i === plan.workOrder.length - 1;
              const volunteer = !!step.trade && /volunteer/i.test(step.trade);
              const chip = "inline-flex min-h-7 items-center rounded-full px-2.5 text-sm font-medium";
              return (
                <li key={step.order} className="relative flex gap-3 py-3">
                  {!last && (
                    <span aria-hidden="true" className="absolute top-12 bottom-0 left-4 w-0.5 -translate-x-1/2 bg-ink/15" />
                  )}
                  <span
                    aria-hidden="true"
                    className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white tabular-nums"
                  >
                    {step.order}
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="font-bold">
                      <span className="sr-only">Step {step.order}: </span>
                      {step.title}
                    </p>
                    <p className="text-sm text-ink/75">{step.detail}</p>
                    {(step.trade || step.hours || step.dependsOn || (step.fixes && step.fixes.length > 0)) && (
                      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Step details">
                        {step.trade && (
                          <li
                            className={
                              volunteer
                                ? `${chip} bg-safe/10 text-safe-dark`
                                : `${chip} border border-ink/20 bg-ink/[0.04] text-ink`
                            }
                          >
                            {volunteer ? "Volunteer" : `Paid: ${step.trade}`}
                          </li>
                        )}
                        {step.hours && <li className={`${chip} bg-ink/[0.06] text-ink/80 tabular-nums`}>About {range(step.hours, " h")}</li>}
                        {step.dependsOn && <li className={`${chip} bg-ink/[0.06] text-ink/80`}>After step {step.dependsOn}</li>}
                        {step.fixes && step.fixes.length > 0 && (
                          <li className={`${chip} bg-ink/[0.06] text-ink/80`}>Fixes #{step.fixes.join(", #")}</li>
                        )}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      {/* Materials and cost sit side by side on desktop (lg+) whenever a cost card renders; phones and tablets stack them. */}
      <div className={plan.costRange || plan.materials.length > 0 ? "lg:grid lg:grid-cols-2 lg:items-start lg:gap-8" : undefined}>
        <Section title="Materials" id="materials">
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
          <Section title="What it might cost" id="cost">
            <div className="rounded-2xl bg-white p-4">
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
      </div>

      {/* The "coming soon" placeholder is screen-only: a saved PDF shows just the finished plan.
          When the after-image step was skipped this run, no slot at all: "Made with" already says it was off. */}
      {!plan.afterImageUrl && !plan.meta?.skipped?.afterImage && plan.workOrder.length > 0 && (
        <Section title="After the work" className="print:hidden">
          <AfterSlot frame={slotFrame} />
        </Section>
      )}

      <MadeWith plan={plan} masks={masks} />
    </article>
  );
}

/** Top-of-plan label for an example: green "Real run" for a real pipeline result, amber "Sample" for a hand-written one. */
function ExampleBanner({ example, videoName, onMakeYourOwn }: { example: Example; videoName: string | null; onMakeYourOwn?: () => void }) {
  const real = example.kind === "real";
  return (
    <div
      className={`mb-4 flex flex-col gap-3 rounded-xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between print:block ${
        real ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-700/20" : "bg-amber-100 text-amber-900"
      }`}
    >
      <p>
        <span
          className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${
            real ? "bg-safe-dark" : "bg-amber-800"
          }`}
        >
          {real ? "Real run" : "Sample"}
        </span>
        {videoName && (
          <>
            <strong>Example shown in place of your plan.</strong> Real analysis isn&apos;t on in this preview, so your video
            &ldquo;{videoName}&rdquo; was not sent anywhere.{" "}
          </>
        )}
        {example.banner}
        {example.credit && (
          <>
            {" "}
            Photo:{" "}
            <a href={example.credit.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {example.credit.author}
            </a>
            , {example.credit.license}.
          </>
        )}
      </p>
      {onMakeYourOwn && (
        <button type="button" onClick={onMakeYourOwn} className="btn-primary shrink-0 self-start text-sm sm:self-auto print:hidden">
          Make your own
        </button>
      )}
    </div>
  );
}
