"use client";

import { useState } from "react";
import type { SaidVsSeenEntry } from "@/lib/types";
import { SAID_VS_SEEN_TAG, saidVsSeenKind } from "@/lib/client/planText";
import { problemAnchor } from "@/lib/client/stepLinks";
import { canFilterUnmentioned, hiddenSaidRowsLine, showSaidVsSeenRow, unmentionedToggleLabel } from "@/lib/client/saidVsSeenFilter";

/**
 * The "You said / We saw" rows. When a plan has both rows the walker mentioned and rows they didn't, a toggle
 * narrows the list to just the things nobody said out loud, so the catch stands out.
 */
export function SaidVsSeenList({ rows, problemRanks }: { rows: SaidVsSeenEntry[]; problemRanks: number[] }) {
  const [onlyUnmentioned, setOnlyUnmentioned] = useState(false);
  const canFilter = canFilterUnmentioned(rows);
  const only = canFilter && onlyUnmentioned;
  const hiddenLine = hiddenSaidRowsLine(rows, only);
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
    </>
  );
}
