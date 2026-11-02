"use client";

import { useEffect, useRef, useState } from "react";
import type { SaidVsSeenEntry } from "@/lib/types";
import { SAID_VS_SEEN_TAG, saidVsSeenKind } from "@/lib/client/planText";
import { problemAnchor } from "@/lib/client/stepLinks";
import { sharePlanText, type ShareResult } from "@/lib/client/planText";
import { prefersShareSheet } from "@/lib/client/savePlanPdf";
import { saidVsSeenShareTitle, saidVsSeenToText } from "@/lib/client/saidVsSeenText";
import { canFilterUnmentioned, hiddenSaidRowsLine, showSaidVsSeenRow, unmentionedToggleLabel } from "@/lib/client/saidVsSeenFilter";

const SEND_STATUS: Record<Exclude<ShareResult, "shared">, string> = {
  copied: "Copied. Paste it into a message.",
  cancelled: "",
  failed: "Couldn't share from this browser.",
};

/**
 * The "You said / We saw" rows. When a plan has both rows the walker mentioned and rows they didn't, a toggle
 * narrows the list to just the things nobody said out loud, so the catch stands out. A send button shares the
 * rows on screen as plain text (share sheet, else clipboard); hidden in print.
 */
export function SaidVsSeenList({
  rows,
  problemRanks,
  spaceName,
  sample,
}: {
  rows: SaidVsSeenEntry[];
  problemRanks: number[];
  spaceName?: string;
  sample?: boolean;
}) {
  const [onlyUnmentioned, setOnlyUnmentioned] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const canFilter = canFilterUnmentioned(rows);
  const only = canFilter && onlyUnmentioned;
  const hiddenLine = hiddenSaidRowsLine(rows, only);
  const text = saidVsSeenToText(rows, { spaceName, sample, onlyUnmentioned: only });
  async function onSend() {
    if (busy || !text) return;
    setBusy(true);
    setStatus("");
    const result = await sharePlanText(saidVsSeenShareTitle(spaceName), text, navigator, prefersShareSheet());
    setBusy(false);
    if (result === "shared") return;
    setStatus(SEND_STATUS[result]);
    if (timer.current) clearTimeout(timer.current);
    if (result === "copied") timer.current = setTimeout(() => setStatus(""), 4000);
  }
  return (
    <>
      {canFilter && (
        <div className="mb-3 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
          <button
            type="button"
            onClick={() => setOnlyUnmentioned((v) => !v)}
            aria-pressed={only}
            aria-controls="said-vs-saw-list"
            data-testid="said-vs-saw-only-unmentioned"
            className="btn-tertiary text-sm"
          >
            {unmentionedToggleLabel(rows, only)}
          </button>
          <p className="text-sm text-ink/70" aria-live="polite" data-testid="said-vs-saw-hidden-line">
            {hiddenLine}
          </p>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl bg-white">
        <div aria-hidden="true" className="hidden grid-cols-2 gap-3 border-b border-ink/10 px-3 py-2 text-xs font-semibold uppercase text-ink/70 sm:grid">
          <span>You said</span>
          <span>We saw</span>
        </div>
        <ul id="said-vs-saw-list" className="divide-y divide-ink/10">
          {rows.map((row, i) => {
            if (!showSaidVsSeenRow(row, only)) return null;
            const kind = saidVsSeenKind(row);
            const linked = row.issueRank !== undefined && problemRanks.includes(row.issueRank);
            return (
              <li key={i} className="grid gap-1 p-3 text-sm sm:grid-cols-2 sm:gap-3" data-testid="said-vs-saw-row" data-kind={kind}>
                <div className="min-w-0 break-words">
                  <span className="mr-1 text-xs font-semibold uppercase text-ink/70 sm:sr-only">Said</span>
                  {row.said ? <>&ldquo;{row.said.quote}&rdquo; <span className="text-ink/65">({row.said.atSec.toFixed(0)} s)</span></> : <span className="text-ink/65">Not mentioned</span>}
                </div>
                <div className="min-w-0 break-words">
                  <span className="mr-1 text-xs font-semibold uppercase text-ink/70 sm:sr-only">Seen</span>
                  <span className={kind === "unmentioned" ? "font-semibold text-accent-dark" : ""}>
                    {row.seen ? row.seen.summary : <span className="text-ink/65">Not visible in the video</span>}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        kind === "unmentioned" ? "bg-accent-dark text-white" : kind === "notSeen" ? "bg-ink/10 text-ink" : "bg-ink/5 text-ink/80"
                      }`}
                    >
                      {SAID_VS_SEEN_TAG[kind]}
                    </span>
                    {linked && (
                      <a href={`#${problemAnchor(row.issueRank as number)}`} className="text-xs font-semibold underline underline-offset-2 print:hidden">
                        Problem {row.issueRank}
                      </a>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {text && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
          <button
            type="button"
            onClick={onSend}
            disabled={busy}
            data-testid="send-said-vs-saw"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-3.5 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 2.5 9 11M17.5 2.5 12 17.5l-3-6.5-6.5-3 15-5.5Z" />
            </svg>
            {only ? "Send what you didn't mention" : "Send this list"}
          </button>
          <p role="status" aria-live="polite" className="text-sm text-ink/70" data-testid="send-said-vs-saw-status">
            {status}
          </p>
        </div>
      )}
    </>
  );
}
