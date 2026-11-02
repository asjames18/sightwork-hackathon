"use client";

import { useEffect, useRef, useState } from "react";
import { activeSection, chipScrollDelta } from "@/lib/client/sectionSpy";
import { chipCount, chipProgress, type ChipTrack } from "@/lib/client/chipCount";
import { useDoneSteps } from "@/lib/client/useDoneSteps";
import { useGotMaterials } from "@/lib/client/useGotMaterials";
import type { WorkPlan } from "@/lib/types";

/**
 * Sticky chip row for the plan sections. The chip for the section on screen is marked (aria-current) and,
 * on narrow screens, slides into view inside the row so it is never hidden off the edge. A chip with a count
 * ("Problems 7") shows how big that part of the plan is before you scroll to it. Once steps or materials are ticked,
 * their chips show progress instead ("Steps 3/8", "Materials 2/5"), following the ticks live.
 */
export function SectionNav({
  chips,
  plan = null,
}: {
  chips: { href: string; label: string; count?: number; track?: ChipTrack }[];
  /** The plan whose ticks the Steps and Materials chips follow. Without it every chip shows its plain count. */
  plan?: Pick<WorkPlan, "spaceName" | "workOrder" | "materials"> | null;
}) {
  const { done } = useDoneSteps(plan);
  const { got } = useGotMaterials(plan);
  const navRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const ids = chips.map((c) => c.href.slice(1)).join(",");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const nav = navRef.current;
      if (!nav) return;
      const line = nav.getBoundingClientRect().bottom + 32;
      const sections = ids
        .split(",")
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => !!el)
        .map((el) => ({ id: el.id, top: el.getBoundingClientRect().top }));
      const doc = document.documentElement;
      const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2 && window.scrollY > 0;
      setCurrent(activeSection(sections, line, atBottom));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || !current) return;
    const chip = row.querySelector<HTMLElement>(`a[href="#${current}"]`);
    if (!chip) return;
    const delta = chipScrollDelta(chip.getBoundingClientRect(), row.getBoundingClientRect());
    if (delta !== 0) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      row.scrollBy({ left: delta, behavior: reduce ? "auto" : "smooth" });
    }
  }, [current]);

  return (
    <nav
      ref={navRef}
      aria-label="Plan sections"
      data-testid="section-nav"
      className="sticky top-[calc(3.5rem+1px+env(safe-area-inset-top))] z-10 -mx-4 mt-6 border-b border-ink/10 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sm:-mx-6 print:hidden"
    >
      <ul ref={rowRef} className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        {chips.map((c) => {
          const on = current === c.href.slice(1);
          const progress = plan && c.track ? chipProgress(c.track === "steps" ? done.length : got.length, c.count, c.track) : null;
          const count = progress ? null : chipCount(c.count);
          return (
            <li key={c.href} className="shrink-0">
              <a
                href={c.href}
                aria-current={on ? "location" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark ${
                  on ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink hover:border-ink/40"
                }`}
              >
                {c.label}
                {count && (
                  <span
                    data-testid="chip-count"
                    className={`ml-1.5 rounded-full px-1.5 text-xs font-bold tabular-nums leading-5 ${on ? "bg-white/20 text-white" : "bg-ink/[.08] text-ink/80"}`}
                  >
                    {count}
                  </span>
                )}
                {progress && (
                  <span
                    data-testid="chip-progress"
                    className={`relative ml-1.5 rounded-full px-1.5 text-xs font-bold tabular-nums leading-5 ${
                      on ? "bg-white/20 text-white" : progress.complete ? "bg-safe-dark/10 text-safe-dark" : "bg-ink/[.08] text-ink/80"
                    }`}
                  >
                    <span aria-hidden="true">{progress.text}</span>
                    {/* Relative badge keeps this off-screen text inside the scrolling chip row, so it can't widen the page. */}
                    <span className="sr-only">, {progress.spoken}</span>
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
