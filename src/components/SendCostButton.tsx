import { useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import { sharePlanText, type ShareResult } from "@/lib/client/planText";
import { prefersShareSheet } from "@/lib/client/savePlanPdf";
import { costShareTitle, costToText } from "@/lib/client/costText";

const SEND_STATUS: Record<Exclude<ShareResult, "shared">, string> = {
  copied: "Copied. Paste it into a message.",
  cancelled: "",
  failed: "Couldn't share from this browser.",
};

/**
 * Sends just the cost card (costText.ts) by the phone's share sheet, else the clipboard, so whoever approves the
 * spend gets the range, what drives it and what it assumes without the whole plan. Renders nothing without a
 * cost range. Hidden in print.
 */
export function SendCostButton({ plan, sample }: { plan: Pick<WorkPlan, "costRange" | "issues" | "workOrder" | "spaceName">; sample?: boolean }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const text = costToText(plan, { sample });
  if (!text) return null;
  async function onSend() {
    if (busy || !text) return;
    setBusy(true);
    setStatus("");
    const result = await sharePlanText(costShareTitle(plan.spaceName), text, navigator, prefersShareSheet());
    setBusy(false);
    if (result === "shared") return;
    setStatus(SEND_STATUS[result]);
    if (timer.current) clearTimeout(timer.current);
    if (result === "copied") timer.current = setTimeout(() => setStatus(""), 4000);
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        data-testid="send-cost"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-3.5 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 2.5 9 11M17.5 2.5 12 17.5l-3-6.5-6.5-3 15-5.5Z" />
        </svg>
        Send the cost
      </button>
      <p role="status" aria-live="polite" className="text-sm text-ink/70">
        {status}
      </p>
    </div>
  );
}
