"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkPlan } from "@/lib/types";
import { gotLine, loadGotMaterials, saveGotMaterials, shoppingListText } from "@/lib/client/materialsList";
import { sharePlanText, type ShareResult } from "@/lib/client/planText";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS: Record<Exclude<ShareResult, "shared">, string> = {
  copied: "Shopping list copied. Paste it into a text or note.",
  cancelled: "",
  failed: "Couldn't share from this browser. Use Save PDF instead.",
};

/** Materials as a shopping list: tick items off as you get them (saved on this device per plan) and send what's still needed. */
export function MaterialsList({ plan, sample = false }: { plan: WorkPlan; sample?: boolean }) {
  const [got, setGot] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = plan.materials.length;

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

  function clearAll() {
    setGot([]);
    saveGotMaterials(plan, []);
  }

  async function onSend() {
    const text = shoppingListText(plan, got, { sample });
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

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 print:hidden">
        <p className="text-sm text-ink/75" aria-live="polite">
          {ready && line ? line : "Tick items off as you get them. Saved on this device."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {got.length > 0 && (
            <button type="button" onClick={clearAll} className="btn-tertiary text-sm">
              Clear ticks
            </button>
          )}
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
                  {[m.forIssues?.length && `for #${m.forIssues.join(", #")}`, m.note].filter(Boolean).join(" · ")}
                </p>
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
