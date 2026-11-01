"use client";

import { useEffect, useRef, useState } from "react";
import { useDoneSteps } from "@/lib/client/useDoneSteps";
import type { WorkPlan } from "@/lib/types";
import { progressLine } from "@/lib/client/stepProgress";
import { shareLabel, type CostShare } from "@/lib/costShares";
import { crewSummary, hoursLabel, isVolunteerTrade, showCrewSummary, stepsLabel, type CrewRow } from "@/lib/client/crewSummary";
import { crewHandoutText, crewHandoutTitle } from "@/lib/client/crewHandout";
import { stepShareTitle, stepToText } from "@/lib/client/stepText";
import { sharePlanText, type ShareNavigator } from "@/lib/client/planText";
import { prefersShareSheet } from "@/lib/client/savePlanPdf";
import { fixLinks, problemAnchor, stepAnchor } from "@/lib/client/stepLinks";
import { calendarFileName, calendarSummary, crewCalendarFileName, planCalendar } from "@/lib/client/stepCalendar";
import { downloadBlob } from "@/lib/client/savePlanPdf";

const range = (r: [number, number], unit = "") => (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}–${r[1]}${unit}`);

/** Ordered work steps as a checklist: tick steps off as the work happens; progress stays on this device for this plan. */
export function WorkSteps({
  plan,
  stepCosts = null,
  problemRanks,
}: {
  plan: WorkPlan;
  /** Each step's share of the rough cost, summing to the total (costShares.ts). */
  stepCosts?: Map<number, CostShare> | null;
  /** Ranks that have a problem card on the page; a step's "Fixes #N" links up to those cards. */
  problemRanks?: ReadonlySet<number>;
}) {
  const { done, ready, update } = useDoneSteps(plan);
  const total = plan.workOrder.length;

  function toggle(order: number, checked: boolean) {
    update(checked ? [...done.filter((n) => n !== order), order] : done.filter((n) => n !== order));
  }

  function clearAll() {
    update([]);
  }

  const line = progressLine(done.length, total);
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const crew = crewSummary(plan.workOrder);
  const totalHours = hoursLabel(crew.totalHours, crew.totalPartial);

  return (
    <>
      {showCrewSummary(crew) && (
        <div className="mb-4 rounded-2xl border border-ink/10 bg-white px-4 py-3 sm:px-5" data-testid="crew-summary">
          <h3 className="text-base font-bold">Who does the work</h3>
          <ul className="mt-2 divide-y divide-ink/10">
            {crew.rows.map((row) => {
              const hrs = hoursLabel(row.hours, row.hoursPartial);
              return (
                <li key={row.label} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4" data-testid="crew-row">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span
                      className={`inline-flex min-h-7 shrink-0 items-center rounded-full px-2.5 text-sm font-medium ${
                        row.paid ? "border border-ink/20 bg-ink/[0.04] text-ink" : "bg-safe/10 text-safe-dark"
                      }`}
                    >
                      {row.paid ? "Paid" : "Free"}
                    </span>
                    <span className="min-w-0 font-semibold break-words">{row.label}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
                    <span className="text-sm text-ink/75 tabular-nums">
                      {stepsLabel(row.steps)}
                      {hrs && <>, {hrs}</>}
                    </span>
                    <CrewSendButton plan={plan} crew={row} />
                    <CrewCalendarButton plan={plan} crew={row} />
                  </span>
                </li>
              );
            })}
            {crew.unassigned.length > 0 && (
              <li className="flex flex-col gap-0.5 py-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4" data-testid="crew-row">
                <span className="font-semibold">Not assigned yet</span>
                <span className="text-sm text-ink/75 tabular-nums">{stepsLabel(crew.unassigned)}</span>
              </li>
            )}
          </ul>
          {totalHours && (
            <p className="mt-1 text-sm text-ink/75" data-testid="crew-total">
              All {total} steps: {totalHours} of work in total, before any waiting between steps.
            </p>
          )}
        </div>
      )}
      <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 print:hidden">
        <p className="text-sm text-ink/75" aria-live="polite">
          {ready && line ? line : "Tick steps off as you go. Saved on this device."}
        </p>
        {done.length > 0 && (
          <button type="button" onClick={clearAll} className="btn-tertiary text-sm">
            Clear ticks
          </button>
        )}
      </div>
      {done.length > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink/10 print:hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-safe-dark transition-[width] motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ol className="rounded-2xl bg-white px-4 py-2 sm:px-5">
        {plan.workOrder.map((step, i) => {
          const last = i === total - 1;
          const isDone = done.includes(step.order);
          const volunteer = !!step.trade && isVolunteerTrade(step.trade);
          const chip = "inline-flex min-h-7 items-center rounded-full px-2.5 text-sm font-medium";
          const id = `step-${step.order}-done`;
          return (
            <li key={step.order} id={stepAnchor(step.order)} className="relative flex scroll-mt-32 gap-3 py-3">
              {!last && (
                <span aria-hidden="true" className="absolute top-12 bottom-0 left-4 w-0.5 -translate-x-1/2 bg-ink/15" />
              )}
              <span
                aria-hidden="true"
                className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white tabular-nums ${
                  isDone ? "bg-safe-dark" : "bg-ink"
                }`}
              >
                {isDone ? (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                ) : (
                  step.order
                )}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className={`font-bold ${isDone ? "text-ink/70 line-through decoration-2" : ""}`}>
                  <span className="sr-only">Step {step.order}: </span>
                  {step.title}
                </p>
                <p className="text-sm text-ink/75">{step.detail}</p>
                {(step.trade || step.hours || step.dependsOn || (step.fixes && step.fixes.length > 0) || stepCosts?.has(step.order)) && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Step details">
                    {step.trade && (
                      <li
                        className={
                          volunteer ? `${chip} bg-safe/10 text-safe-dark` : `${chip} border border-ink/20 bg-ink/[0.04] text-ink`
                        }
                      >
                        {volunteer ? "Volunteer" : `Paid: ${step.trade}`}
                      </li>
                    )}
                    {step.hours && <li className={`${chip} bg-ink/[0.06] text-ink/80 tabular-nums`}>About {range(step.hours, " h")}</li>}
                    {step.dependsOn && <li className={`${chip} bg-ink/[0.06] text-ink/80`}>After step {step.dependsOn}</li>}
                    {step.fixes && step.fixes.length > 0 && (
                      <FixesChip className={`${chip} bg-ink/[0.06] text-ink/80`} fixes={step.fixes} problemRanks={problemRanks} />
                    )}
                    {stepCosts?.get(step.order) && (
                      <li className={`${chip} border border-ink/15 bg-white font-semibold text-ink tabular-nums`} data-testid="step-cost">
                        <span className="sr-only">Cost share: </span>
                        {shareLabel(stepCosts.get(step.order)!)}
                      </li>
                    )}
                  </ul>
                )}
                <StepSendButton plan={plan} step={step} />
              </div>
              <label
                htmlFor={id}
                className="-mr-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 self-start rounded-xl px-2 text-sm font-medium text-ink/80 hover:bg-ink/[0.04] print:hidden"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={isDone}
                  onChange={(e) => toggle(step.order, e.target.checked)}
                  className="h-6 w-6 cursor-pointer accent-[var(--color-safe-dark)]"
                  aria-label={`Step ${step.order} done: ${step.title}`}
                />
                <span aria-hidden="true" className="hidden sm:inline">Done</span>
              </label>
            </li>
          );
        })}
      </ol>
      <CalendarButton plan={plan} />
    </>
  );
}

/** "Add to calendar": downloads the steps as a .ics file, back to back on weekdays 9 to 5 from the next workday. */
function CalendarButton({ plan }: { plan: WorkPlan }) {
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("");
  // The start day depends on today, so it is worked out after mount (no server/client mismatch).
  useEffect(() => setSummary(calendarSummary(plan.workOrder)), [plan]);

  function onAdd() {
    const now = new Date();
    const name = calendarFileName(now);
    const ok = downloadBlob(new Blob([planCalendar(plan, now)], { type: "text/calendar;charset=utf-8" }), name);
    setStatus(ok ? `Saved ${name}. Open it to add the steps to your calendar.` : "Couldn't save a calendar file in this browser.");
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 print:hidden" data-testid="step-calendar">
      <div className="min-w-0">
        <p className="font-semibold">Put the steps on a calendar</p>
        <p className="text-sm text-ink/75" data-testid="step-calendar-summary">
          {summary || "Back to back on weekdays, 9 to 5, from the next workday."}
        </p>
      </div>
      <div className="flex flex-col gap-1 sm:items-end">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark sm:self-end"
          data-testid="step-calendar-add"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
            <path d="M3 8.5h14M7 2.5v4M13 2.5v4M10 11v4M8 13h4" />
          </svg>
          Add to calendar
        </button>
        <span role="status" aria-live="polite" className="text-sm text-ink/70">
          {status}
        </span>
      </div>
    </div>
  );
}

/** "Fixes #1, #3": each rank that has a problem card on the page is a link up to it; other ranks stay plain. */
function FixesChip({ className, fixes, problemRanks }: { className: string; fixes: number[]; problemRanks?: ReadonlySet<number> }) {
  const { linked, plain } = fixLinks(fixes, problemRanks ?? new Set());
  const all = [...linked.map((r) => ({ r, link: true })), ...plain.map((r) => ({ r, link: false }))];
  return (
    <li className={className} data-testid="step-fixes">
      Fixes&nbsp;
      {all.map(({ r, link }, i) => (
        <span key={r}>
          {i > 0 && ", "}
          {link ? (
            <a
              href={`#${problemAnchor(r)}`}
              className="inline-flex min-h-6 min-w-6 items-center justify-center font-semibold text-accent-dark underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
              aria-label={`Go to problem ${r}`}
            >
              #{r}
            </a>
          ) : (
            <>#{r}</>
          )}
        </span>
      ))}
    </li>
  );
}

/**
 * Sends just this step (stepText.ts) by the phone's share sheet, else the clipboard, so one step can go to the one
 * person doing it: when, how long, what it fixes, what to wait for and what to bring. Hidden in print.
 */
function StepSendButton({ plan, step }: { plan: WorkPlan; step: WorkPlan["workOrder"][number] }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onSend() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    const text = stepToText(plan, step, { sample: plan.meta?.isExample === true, scheduleFrom: new Date() });
    const result = await sharePlanText(stepShareTitle(step), text, navigator as ShareNavigator, prefersShareSheet());
    setBusy(false);
    if (result === "shared") return;
    setStatus(CREW_STATUS[result]);
    if (timer.current) clearTimeout(timer.current);
    if (result === "copied") timer.current = setTimeout(() => setStatus(""), 4000);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        data-testid="send-step"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-3.5 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 2.5 9 11M17.5 2.5 12 17.5l-3-6.5-6.5-3 15-5.5Z" />
        </svg>
        Send this step<span className="sr-only"> {step.order}</span>
      </button>
      <p role="status" aria-live="polite" className="text-sm text-ink/70">
        {status}
      </p>
    </div>
  );
}

const CREW_STATUS = { copied: "Copied. Paste it into a text.", cancelled: "", failed: "Couldn't share from this browser." } as const;

/** Sends one crew just their steps and materials: the phone's share sheet when there is one, else the clipboard. */
function CrewSendButton({ plan, crew }: { plan: WorkPlan; crew: CrewRow }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onSend() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    const result = await sharePlanText(crewHandoutTitle(plan, crew), crewHandoutText(plan, crew, { scheduleFrom: new Date() }), navigator as ShareNavigator, prefersShareSheet());
    setBusy(false);
    if (result === "shared") return;
    setStatus(CREW_STATUS[result]);
    if (timer.current) clearTimeout(timer.current);
    if (result === "copied") timer.current = setTimeout(() => setStatus(""), 4000);
  }

  return (
    <span className="inline-flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        aria-label={`Send ${crew.label} their steps`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/20 bg-white px-3 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
        data-testid="crew-send"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13V3M6 7l4-4 4 4" />
          <path d="M4 11v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5" />
        </svg>
        Send
      </button>
      <span role="status" aria-live="polite" className="text-sm text-ink/70">
        {status}
      </span>
    </span>
  );
}

/** One crew's steps as their own .ics, at the same times as the full "Add to calendar" file. */
function CrewCalendarButton({ plan, crew }: { plan: WorkPlan; crew: CrewRow }) {
  const [status, setStatus] = useState("");

  function onAdd() {
    const now = new Date();
    const name = crewCalendarFileName(crew.label, now);
    const ics = planCalendar(plan, now, { only: crew.steps, label: crew.label });
    const ok = downloadBlob(new Blob([ics], { type: "text/calendar;charset=utf-8" }), name);
    setStatus(ok ? "Saved. Send the file to them." : "Couldn't save a calendar file.");
  }

  return (
    <span className="inline-flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Calendar file of ${crew.label}'s steps`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/20 bg-white px-3 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
        data-testid="crew-calendar"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
          <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
        </svg>
        Calendar
      </button>
      <span role="status" aria-live="polite" className="text-sm text-ink/70">
        {status}
      </span>
    </span>
  );
}
