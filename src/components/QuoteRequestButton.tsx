import { useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import type { CrewRow } from "@/lib/client/crewSummary";
import { sharePlanText, type ShareNavigator } from "@/lib/client/planText";
import { prefersShareSheet } from "@/lib/client/savePlanPdf";
import { quoteRequestText, quoteRequestTitle } from "@/lib/client/quoteRequest";

const STATUS = { copied: "Copied. Paste it into a text or an email.", cancelled: "", failed: "Couldn't share from this browser." } as const;

/**
 * On a paid row of Who does the work: sends a short quote request for that trade (the job, the hours the plan
 * expects, what to answer) by the phone's share sheet, else the clipboard. Renders nothing for volunteers or a
 * row with no steps. Hidden in print.
 */
export function QuoteRequestButton({ plan, crew }: { plan: WorkPlan; crew: CrewRow }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  if (!crew.paid || crew.steps.length === 0) return null;

  async function onSend() {
    if (busy) return;
    const text = quoteRequestText(plan, crew);
    if (!text) return;
    setBusy(true);
    setStatus("");
    const result = await sharePlanText(quoteRequestTitle(plan, crew.label), text, navigator as ShareNavigator, prefersShareSheet());
    setBusy(false);
    if (result === "shared") return;
    setStatus(STATUS[result]);
    if (timer.current) clearTimeout(timer.current);
    if (result === "copied") timer.current = setTimeout(() => setStatus(""), 4000);
  }

  return (
    <span className="inline-flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        aria-label={`Ask for a quote: send ${crew.label} a request`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/20 bg-white px-3 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
        data-testid="quote-request"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 2.5h7l3 3v12H5z" />
          <path d="M12 2.5v3h3M7.5 10h5M7.5 13h3" />
        </svg>
        Ask for a quote
      </button>
      <span role="status" aria-live="polite" className="text-sm text-ink/70" data-testid="quote-request-status">
        {status}
      </span>
    </span>
  );
}
