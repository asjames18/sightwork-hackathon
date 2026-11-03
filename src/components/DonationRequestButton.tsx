import { useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import { sharePlanText, type ShareNavigator } from "@/lib/client/planText";
import { prefersShareSheet } from "@/lib/client/savePlanPdf";
import { donationRequestText, donationRequestTitle } from "@/lib/client/donationRequest";

const STATUS = { copied: "Copied. Paste it into a text or an email.", cancelled: "", failed: "Couldn't share from this browser." } as const;

/**
 * Beside the shopping list: sends a short note asking a hardware store or local business to donate or discount
 * the items still needed (no prices in it), by the phone's share sheet, else the clipboard. Items already ticked
 * off are left out. Hidden in print.
 */
export function DonationRequestButton({ plan, got, sample = false }: { plan: WorkPlan; got: number[]; sample?: boolean }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  if (plan.materials.length === 0 || got.length >= plan.materials.length) return null;

  async function onSend() {
    if (busy) return;
    const text = donationRequestText(plan, got, { sample });
    if (!text) return;
    setBusy(true);
    setStatus("");
    const result = await sharePlanText(donationRequestTitle(plan), text, navigator as ShareNavigator, prefersShareSheet());
    setBusy(false);
    if (result === "shared") return;
    setStatus(STATUS[result]);
    if (timer.current) clearTimeout(timer.current);
    if (result === "copied") timer.current = setTimeout(() => setStatus(""), 4000);
  }

  return (
    <>
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        aria-label="Ask a store to donate: send a donation request for the items still needed"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
        data-testid="donation-request"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 16.5s-6.5-3.8-6.5-8.6A3.4 3.4 0 0 1 10 6.3a3.4 3.4 0 0 1 6.5 1.6c0 4.8-6.5 8.6-6.5 8.6z" />
        </svg>
        Ask a store to donate
      </button>
      <span role="status" aria-live="polite" className="basis-full text-sm text-ink/70 empty:hidden" data-testid="donation-request-status">
        {status}
      </span>
    </>
  );
}
