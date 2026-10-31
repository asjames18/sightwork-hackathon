"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import type { Example } from "@/lib/examples";
import { usePlanComparison } from "@/lib/client/usePlanComparison";
import {
  deliverPlanPdf,
  downloadBlob,
  getPlanPdf,
  pdfKeyOf,
  peekPlanPdf,
  prefersShareSheet,
  warmPlanPdf,
  type DeliverResult,
  type PlanPdf,
} from "@/lib/client/savePlanPdf";

type State = "idle" | "working" | "tap";

const MESSAGES: Record<Exclude<DeliverResult, "shared" | "cancelled" | "needs-tap">, (name: string) => string> = {
  downloaded: (name) => `Saved ${name}. Check your downloads.`,
  failed: () => "Couldn't save the PDF in this browser. Open the plan in Safari or Chrome and try again.",
};

/**
 * Header "Save PDF": builds a real PDF file from the plan (jsPDF, loaded on first use). Phones get the share
 * sheet with the file, so Save to Files works; computers download sightwork-plan-<date>.pdf. If the file can't
 * be built, the print dialog opens instead; if that's missing too, a short message says what to do.
 */
export function SavePdfButton({ plan, example, sample }: { plan: WorkPlan; example?: Example; sample: boolean }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const held = useRef<PlanPdf | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  // Real plans only: the PDF then has the same "Since your last walkthrough" section as the screen.
  const since = usePlanComparison(plan, !sample && !example && !plan.meta?.isExample);
  const label = { sample, example: example ? { kind: example.kind, banner: example.banner } : null, since };
  const labelKey = `${example?.id ?? ""}|${pdfKeyOf(label)}`;

  // A new plan drops a file waiting for a second tap.
  useEffect(() => {
    held.current = null;
    setState("idle");
    setMessage("");
  }, [plan]);

  // Phones: build the file once the page is idle, so the tap can share it straight away.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => warmPlanPdf(plan, label), [plan, labelKey]);

  function report(result: DeliverResult, pdf: PlanPdf) {
    if (result === "needs-tap") {
      held.current = pdf;
      setState("tap");
      setMessage("Your PDF is ready. Tap Save PDF again to save or send it.");
      return;
    }
    held.current = null;
    setState("idle");
    setMessage(result === "shared" || result === "cancelled" ? "" : MESSAGES[result](pdf.name));
    if (timer.current) clearTimeout(timer.current);
    if (result === "downloaded") timer.current = setTimeout(() => setMessage(""), 6000);
  }

  function deliver(pdf: PlanPdf, retry: boolean) {
    return deliverPlanPdf(pdf, { nav: navigator, preferShare: prefersShareSheet(), download: (b, n) => downloadBlob(b, n), retry });
  }

  async function onClick() {
    if (state === "working") return;
    setMessage("");
    // Already built (second tap, or warmed on a phone): share inside this tap, nothing awaited first.
    const now = held.current ?? peekPlanPdf(plan, label);
    if (now) {
      const retry = state === "tap";
      setState("working");
      report(await deliver(now, retry), now);
      return;
    }
    setState("working");
    let pdf: PlanPdf;
    try {
      pdf = await getPlanPdf(plan, label);
    } catch {
      setState("idle");
      if (typeof window.print === "function") {
        setMessage("Couldn't build the PDF here, so the print dialog opened. Choose Save as PDF.");
        window.print();
      } else {
        setMessage(MESSAGES.failed(""));
      }
      return;
    }
    report(await deliver(pdf, false), pdf);
  }

  const working = state === "working";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-busy={working}
        aria-disabled={working}
        data-state={state}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          state === "tap" ? "border-accent-dark bg-accent-dark text-white" : "border-ink/20 bg-white/60 hover:border-ink/40"
        } ${working ? "cursor-progress opacity-80" : ""}`}
      >
        {working ? (
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 motion-safe:animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 2.5a7.5 7.5 0 1 1-7.5 7.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3v9M6 8l4 4 4-4" />
            <path d="M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
          </svg>
        )}
        <span>{working ? "Making PDF…" : "Save PDF"}</span>
      </button>
      <p
        role="status"
        aria-live="polite"
        data-testid="save-pdf-status"
        className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl bg-ink px-3 py-2 text-sm text-white shadow-lg empty:hidden"
      >
        {message}
      </p>
    </div>
  );
}
