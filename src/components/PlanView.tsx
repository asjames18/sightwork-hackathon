import type { Issue, WorkPlan } from "@/lib/types";
import { ProofFrame } from "./ProofFrame";
import { BeforeAfter } from "./BeforeAfter";

const SEVERITY: Record<Issue["severity"], string> = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-400 text-ink",
  low: "bg-ink/10 text-ink",
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const range = (r: [number, number], unit = "") => (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`);

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-10">
      <h2 className="mb-3 text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function SaidBadge({ issue }: { issue: Issue }) {
  if (issue.unmentioned)
    return <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">You didn&apos;t mention this</span>;
  if (issue.status === "mentioned_not_seen")
    return <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-semibold">You said it, check in person</span>;
  return (
    <span className="rounded-full bg-safe/15 px-2 py-0.5 text-xs font-semibold text-safe">
      You said it{issue.mention ? ` at ${issue.mention.saidAtSec.toFixed(0)} s` : ""}
    </span>
  );
}

export function PlanView({ plan, videoName }: { plan: WorkPlan; videoName: string | null }) {
  const frames = plan.frames ?? [];
  const unmentioned = plan.issues.filter((i) => i.unmentioned);
  const hero = plan.heroFrameIndex !== undefined ? frames[plan.heroFrameIndex] : undefined;

  return (
    <article>
      {plan.meta?.isExample && (
        <p className="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
          <strong>Example plan.</strong> Made-up data for a church sanctuary stage
          {videoName ? `, shown because real analysis isn't connected yet (your video "${videoName}" was not sent anywhere)` : ""}.
        </p>
      )}

      <h1 className="text-3xl font-extrabold leading-tight">{plan.spaceName}</h1>
      <p className="mt-1 text-sm text-ink/60">{plan.generatedFrom}</p>

      {unmentioned.length > 0 && (
        <a href="#problems" className="mt-5 block rounded-2xl bg-ink p-5 text-white">
          <p className="text-4xl font-extrabold text-accent">{unmentioned.length}</p>
          <p className="text-lg font-semibold">
            problem{unmentioned.length === 1 ? "" : "s"} you didn&apos;t mention
          </p>
          <p className="mt-1 text-sm text-white/70">{unmentioned.map((i) => i.title).join(" · ")}</p>
        </a>
      )}

      {plan.transcriptSummary && (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm">
          <span className="font-semibold">What you asked for: </span>
          {plan.transcriptSummary}
        </p>
      )}

      <Section title="Problems, worst first" id="problems">
        <ol className="space-y-4">
          {plan.issues.map((issue) => {
            const proof = issue.proofFrames?.[0];
            return (
              <li key={issue.rank} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold tabular-nums">#{issue.rank}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${SEVERITY[issue.severity]}`}>{issue.severity}</span>
                  <SaidBadge issue={issue} />
                </div>
                <h3 className="mt-2 text-lg font-bold leading-snug">{issue.title}</h3>
                <p className="mt-1 text-sm text-ink/75">{issue.detail}</p>
                {issue.status !== "mentioned_not_seen" && (
                  <div className="mt-3">
                    <ProofFrame frame={frames[proof?.frameIndex ?? issue.frameIndex]} box={proof?.box} caption={proof?.caption} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Section>

      {plan.saidVsSeen && plan.saidVsSeen.length > 0 && (
        <Section title="What you said vs. what we saw">
          <ul className="divide-y divide-ink/10 rounded-2xl bg-white">
            {plan.saidVsSeen.map((row, i) => (
              <li key={i} className="grid grid-cols-2 gap-3 p-3 text-sm">
                <div>{row.said ? <>&ldquo;{row.said.quote}&rdquo; <span className="text-ink/50">({row.said.atSec.toFixed(0)} s)</span></> : <span className="text-ink/40">Not mentioned</span>}</div>
                <div className={row.status === "unmentioned" ? "font-semibold text-accent" : ""}>
                  {row.seen ? row.seen.summary : <span className="text-ink/40">Not visible in the video</span>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="What's there">
        <ul className="grid grid-cols-2 gap-3">
          {plan.inventory.map((item) => (
            <li key={item.label} className="rounded-2xl bg-white p-4">
              <p className="text-3xl font-extrabold tabular-nums">{item.range ? range(item.range) : item.count}</p>
              <p className="font-medium">{item.label}</p>
              {item.zone && <p className="text-xs text-ink/50">{item.zone}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink/50">Approximate, counted from the video.</p>
      </Section>

      <Section title="Do the work in this order">
        <ol className="space-y-3">
          {plan.workOrder.map((step) => (
            <li key={step.order} className="flex gap-3 rounded-2xl bg-white p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-bold text-white">{step.order}</span>
              <div>
                <p className="font-bold">{step.title}</p>
                <p className="text-sm text-ink/75">{step.detail}</p>
                <p className="mt-1 text-xs text-ink/50">
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
        <ul className="divide-y divide-ink/10 rounded-2xl bg-white">
          {plan.materials.map((m) => (
            <li key={m.item} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium">{m.item}</p>
                <p className="text-xs text-ink/50">
                  {[m.forIssues?.length && `for #${m.forIssues.join(", #")}`, m.note].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{m.qty}</p>
                {m.unitCost && <p className="text-xs text-ink/50">{usd(m.unitCost[0])}–{usd(m.unitCost[1])} each</p>}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {plan.costRange && (
        <Section title="What it might cost">
          <div className="rounded-2xl bg-white p-5">
            <p className="text-3xl font-extrabold tabular-nums">
              {usd(plan.costRange.low)} – {usd(plan.costRange.high)}
            </p>
            <p className="mt-1 text-sm font-semibold text-accent">{plan.costRange.label}</p>
            <p className="mt-2 text-sm">
              Region: {plan.costRange.region} · Labor: {plan.costRange.laborBasis}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-ink/70">
              {plan.costRange.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {plan.afterImageUrl && hero && (
        <Section title="Before and after">
          <BeforeAfter before={hero.url} after={plan.afterImageUrl} label={plan.afterImageLabel ?? "AI concept, not a render"} />
        </Section>
      )}
    </article>
  );
}
