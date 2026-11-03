"use client";

import { useEffect, useState } from "react";
import { loadTextSize, nextTextSize, saveTextSize, textSizeCss, textSizeLabel, textSizeStatus, type TextSize } from "@/lib/client/textSize";

/**
 * Cycles the plan's text size (Normal, Large, Extra large). The choice scales the whole page and is kept on this
 * device; it is dropped again when the plan screen closes so the camera and upload screens keep their own layout.
 * Never in print.
 */
export function TextSizeButton() {
  const [size, setSize] = useState<TextSize>("normal");
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    setSize(loadTextSize());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = textSizeCss(size);
    return () => {
      root.style.fontSize = "";
    };
  }, [size]);

  function press() {
    const next = nextTextSize(size);
    setSize(next);
    saveTextSize(next);
    setAnnounce(textSizeStatus(next));
  }

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={press}
        data-testid="text-size"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
      >
        <span aria-hidden="true" className="flex items-baseline font-extrabold leading-none">
          <span className="text-xs">A</span>
          <span className="text-base">A</span>
        </span>
        {textSizeLabel(size)}
      </button>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
