"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import {
  gotLine,
  loadGotMaterials,
  materialsSpend,
  saveGotMaterials,
  shoppingListText,
  spendLine,
} from "@/lib/client/materialsList";
import { firstNeededLine, materialsNeededBy, neededByLine } from "@/lib/client/materialsNeededBy";
import { sharePlanText, type ShareResult } from "@/lib/client/planText";
import { fixLinks, problemAnchor } from "@/lib/client/stepLinks";
import { ClearTicksButton } from "@/components/ClearTicksButton";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS: Record<Exclude<ShareResult, "shared">, string> = {
  copied: "Shopping list copied. Paste it into a text or note.",
  cancelled: "",
  failed: "Couldn't share from this browser. Use Save PDF instead.",
};

/** Materials as a shopping list: tick items off as you get them (saved on this device per plan) and send what's still needed. */
export function MaterialsList({
  plan,
  sample = false,
  problemRanks,
}: {
  plan: WorkPlan;
  sample?: boolean;
  /** Ranks that have a problem card on the page; "for #N" links up to those cards. */
  problemRanks?: ReadonlySet<number>;
}) {
  const [got, setGot] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = plan.materials.length;
  // Dates depend on today, so they are worked out only after mount (the server render has none).
  const neededBy = useMemo(() => (ready ? materialsNeededBy(plan) : []), [plan, ready]);

  useEffect(() => {
    setGot(loadGotMaterials(plan));
    setReady(true);
  }, [plan]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function toggle(i: number, checked: boolean) {
    const next = checked ? [...got, i] : got.filter((n) => n !== i);
    setGot(next);
    saveGotMaterials(plan, next);
  }

  function setTicks(next: number[]) {
    setGot(next);
    saveGotMaterials(plan, next);
  }

  async function onSend() {
    const text = shoppingListText(plan, got, { sample, now: new Date() });
    if (busy || !text) return;
    setBusy(true);
    setStatus("");
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
    const result = await sharePlanText(`Shopping list: ${plan.spaceName}`, text, navigator, coarse);
    setBusy(false);
    if (result === "shared") return;
    setStatus(STATUS[result]);
    if (timer.current) clearTimeout(timer.current);
    if (result === "copied") timer.current = setTimeout(() => setStatus(""), 4000);
  }

  const line = gotLine(got.length, total);
  const allGot = total > 0 && got.length >= total;
  const spend = ready && !allGot ? spendLine(materialsSpend(plan, got), { started: got.length > 0 }) : "";
  const buyFirst = ready && !allGot ? firstNeededLine(neededBy, got) : "";

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 print:hidden">
        <p className="text-sm text-ink/75" aria-live="polite">
          {ready && line ? line : "Tick items off as you get them. Saved on this device."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ClearTicksButton ticked={got} noun="item" onChange={setTicks} />
          <button
            type="button"
            onClick={onSend}
            disabled={busy || allGot}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4h2l1.6 8.2a1 1 0 0 0 1 .8h6.6a1 1 0 0 0 1-.8L16.5 7H6" />
              <circle cx="8.5" cy="16" r="1" />
              <circle cx="14" cy="16" r="1" />
            </svg>
            {got.length > 0 ? "Send what's left" : "Send shopping list"}
          </button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="mb-2 text-sm text-ink/70 empty:hidden print:hidden">
        {status}
      </p>
      {spend && (
        <p data-testid="materials-spend" className="mb-3 rounded-xl bg-ink/[0.04] px-3 py-2 text-sm text-ink/80">
          {spend} Rough estimate, not a quote.
        </p>
      )}
      {buyFirst && (
        <p data-testid="materials-buy-first" className="mb-3 flex items-start gap-2 text-sm font-semibold text-ink">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4.5" width="14" height="12" rx="2" />
            <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
          </svg>
          <span>{buyFirst}</span>
        </p>
      )}
      <ul className="divide-y divide-ink/10 rounded-2xl bg-white">
        {plan.materials.map((m, i) => {
          const isGot = got.includes(i);
          const id = `material-${i}-got`;
          return (
            <li key={`${i}:${m.item}`} className="flex items-start gap-3 p-3 text-sm">
              <label
                htmlFor={id}
                className="-my-1 -ml-1 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl hover:bg-ink/[0.04] print:hidden"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={isGot}
                  onChange={(e) => toggle(i, e.target.checked)}
                  className="h-6 w-6 cursor-pointer accent-[var(--color-safe-dark)]"
                  aria-label={`Got it: ${m.item}`}
                />
              </label>
              <div className="min-w-0 flex-1 pt-1.5 print:pt-0">
                <p className={`font-medium break-words ${isGot ? "text-ink/70 line-through decoration-2" : ""}`}>{m.item}</p>
                <p className="text-sm text-ink/70">
                  {m.forIssues?.length ? <ForIssues ranks={m.forIssues} problemRanks={problemRanks} /> : null}
                  {m.forIssues?.length && m.note ? " · " : null}
                  {m.note}
                </p>
                {neededBy[i] && !isGot && (
                  <p data-testid="material-needed-by" className="text-sm font-medium text-ink/80">
                    {neededByLine(neededBy[i])}
                  </p>
                )}
              </div>
              <div className="shrink-0 pt-1.5 text-right print:pt-0">
                <p className="font-semibold">{m.qty}</p>
                {m.unitCost && (
                  <p className="text-sm text-ink/70">
                    {usd(m.unitCost[0])}–{usd(m.unitCost[1])} each
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** "for #1, #3": each rank with a problem card on the page links up to it, others stay plain. */
function ForIssues({ ranks, problemRanks }: { ranks: number[]; problemRanks?: ReadonlySet<number> }) {
  const { linked } = fixLinks(ranks, problemRanks ?? new Set());
  const canLink = new Set(linked);
  const seen = new Set<number>();
  const shown = ranks.filter((r) => (seen.has(r) ? false : (seen.add(r), true)));
  return (
    <span data-testid="material-for">
      for{" "}
      {shown.map((r, i) => (
        <span key={r}>
          {i > 0 && ", "}
          {canLink.has(r) ? (
            <a
              href={`#${problemAnchor(r)}`}
              className="inline-flex min-h-6 min-w-6 items-center justify-center font-semibold text-accent-dark underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark print:text-ink print:no-underline"
              aria-label={`Go to problem ${r}`}
            >
              #{r}
            </a>
          ) : (
            <>#{r}</>
          )}
        </span>
      ))}
    </span>
  );
}
