"use client";

import { useEffect, useState } from "react";
import { contrastAttr, contrastLabel, contrastStatus, loadContrast, nextContrast, saveContrast, type Contrast } from "@/lib/client/contrast";

/**
 * Flips the plan between normal and high contrast (darker text and borders). The choice is kept on this device and is
 * dropped from the page again when the plan screen closes so the camera and upload screens keep their own look.
 * Never in print.
 */
export function ContrastButton() {
  const [contrast, setContrast] = useState<Contrast>("normal");
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    setContrast(loadContrast());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const attr = contrastAttr(contrast);
    if (attr) root.setAttribute("data-contrast", attr);
    else root.removeAttribute("data-contrast");
    return () => {
      root.removeAttribute("data-contrast");
    };
  }, [contrast]);

  function press() {
    const next = nextContrast(contrast);
    setContrast(next);
    saveContrast(next);
    setAnnounce(contrastStatus(next));
  }

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={press}
        aria-pressed={contrast === "high"}
        data-testid="contrast"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 1.8v12.4a6.2 6.2 0 0 0 0-12.4Z" fill="currentColor" stroke="none" />
        </svg>
        {contrastLabel(contrast)}
      </button>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
