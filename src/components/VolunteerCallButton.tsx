import { useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import type { CrewRow } from "@/lib/client/crewSummary";
import { sharePlanText, type ShareNavigator } from "@/lib/client/planText";
import { prefersShareSheet } from "@/lib/client/savePlanPdf";
import { volunteerCallText, volunteerCallTitle } from "@/lib/client/volunteerCall";

const STATUS = { copied: "Copied. Paste it into a text or an announcement.", cancelled: "", failed: "Couldn't share from this browser." } as const;

/**
 * On the Volunteers row of Who does the work: sends a short call for help (what the work is, how long, what to
 * bring, what waits on a paid trade) by the phone's share sheet, else the clipboard. Renders nothing for a paid
 * crew or a row with no steps. Hidden in print.
 */
export function VolunteerCallButton({ plan, crew }: { plan: WorkPlan; crew: CrewRow }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  if (crew.paid || crew.steps.length === 0) return null;

  async function onSend() {
    if (busy) return;
    const text = volunteerCallText(plan, crew);
    if (!text) return;
    setBusy(true);
    setStatus("");
    const result = await sharePlanText(volunteerCallTitle(plan), text, navigator as ShareNavigator, prefersShareSheet());
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
        aria-label="Ask for help: send volunteers a call"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/20 bg-white px-3 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
        data-testid="volunteer-call"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8v4a1 1 0 0 0 1 1h2l5 3.5v-13L6 7H4a1 1 0 0 0-1 1Z" />
          <path d="M14.5 7.5a3.5 3.5 0 0 1 0 5" />
        </svg>
        Ask for help
      </button>
      <span role="status" aria-live="polite" className="text-sm text-ink/70" data-testid="volunteer-call-status">
        {status}
      </span>
    </span>
  );
}
