"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import type { Example } from "@/lib/examples";
import { canShareFiles, planToText, sharePlanText, type ShareResult } from "@/lib/client/planText";
import { compareShareLines } from "@/lib/client/planCompare";
import { usePlanComparison } from "@/lib/client/usePlanComparison";
import { pdfKeyOf, peekPlanPdf, prefersShareSheet, warmPlanPdf } from "@/lib/client/savePlanPdf";

const STATUS: Record<Exclude<ShareResult, "shared">, string> = {
  copied: "Plan copied. Paste it into a text or email.",
  cancelled: "",
  failed: "Couldn't share from this browser. Use Save PDF instead.",
};

/**
 * Sends the plan as plain text: the phone's share sheet when there is one, else the clipboard. When the share
 * sheet takes files and the plan PDF is built (warmed in the background on phones), the PDF rides along, so the
 * proof photos reach the teammate too.
 */
export function SharePlanButton({ plan, sample = false, example }: { plan: WorkPlan; sample?: boolean; example?: Example }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Real plans only: the text then says what changed since the last walkthrough of this space, like the card.
  const since = usePlanComparison(plan, !sample && !example && !plan.meta?.isExample);
  const sinceLines = since ? compareShareLines(since.comparison, since.when) : undefined;

  // Same label as Save PDF (comparison included), so both buttons share one built file.
  const label = { sample, example: example ? { kind: example.kind, banner: example.banner } : null, since };
  const labelKey = `${example?.id ?? ""}|${pdfKeyOf(label)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => warmPlanPdf(plan, label), [plan, labelKey]);

  async function onShare() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    const coarse = prefersShareSheet();
    // Only a PDF that is already built: waiting for one here would let the tap go stale and iOS refuse the share.
    const pdf = coarse ? peekPlanPdf(plan, label) : null;
    const attach = pdf && canShareFiles(navigator, [pdf.file]) ? { files: [pdf.file], text: planToText(plan, { sample, pdfAttached: true, sinceLines }) } : null;
    const result = await sharePlanText(`Work plan: ${plan.spaceName}`, planToText(plan, { sample, sinceLines }), navigator, coarse, attach);
    setBusy(false);
    if (result === "shared") return;
    setStatus(STATUS[result]);
    if (timer.current) clearTimeout(timer.current);
    if (result === "copied") timer.current = setTimeout(() => setStatus(""), 4000);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      <button
        type="button"
        onClick={onShare}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13V3M6 7l4-4 4 4" />
          <path d="M4 11v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5" />
        </svg>
        Send to your team
      </button>
      <p role="status" aria-live="polite" className="text-sm text-ink/70">
        {status}
      </p>
    </div>
  );
}
