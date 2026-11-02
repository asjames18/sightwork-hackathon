"use client";

import { useEffect, useRef, useState } from "react";
import { canShareFiles, sharePlanText, type ShareNavigator } from "@/lib/client/planText";
import { downloadBlob, prefersShareSheet } from "@/lib/client/savePlanPdf";
import { beforeAfterShareText, beforeAfterShareTitle, getBeforeAfterPhoto } from "@/lib/client/beforeAfterPhoto";

/**
 * "Send before and after": one picture with the real frame and the AI concept side by side, labeled, through the
 * phone's share sheet. On a computer it downloads the picture. If the picture can't be made in this browser, the
 * short text goes alone (share sheet or clipboard). Hidden in print.
 */
export function SendBeforeAfterButton({
  before,
  after,
  label,
  spaceName,
  sample,
}: {
  before: string;
  after: string;
  label: string;
  spaceName?: string | null;
  sample?: boolean;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ready = useRef<File | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  // On a phone whose share sheet takes files, build the picture ahead so the tap can share it at once.
  useEffect(() => {
    ready.current = null;
    if (!prefersShareSheet()) return;
    const probe = new File([new Uint8Array([255, 216, 255])], "probe.jpg", { type: "image/jpeg" });
    if (!canShareFiles(navigator as ShareNavigator, [probe])) return;
    let live = true;
    const t = setTimeout(() => {
      void getBeforeAfterPhoto(before, after, { spaceName, label }).then((file) => {
        if (live) ready.current = file;
      });
    }, 500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [before, after, spaceName, label]);

  function flash(text: string) {
    setStatus(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), 4000);
  }

  async function onSend() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    const text = beforeAfterShareText(spaceName, label, { sample });
    const title = beforeAfterShareTitle(spaceName);
    const share = prefersShareSheet();
    if (share) {
      const file = ready.current;
      const result = await sharePlanText(title, text, navigator as ShareNavigator, true, file ? { files: [file], text } : null);
      setBusy(false);
      if (result === "copied") flash("Copied. Paste it into a message.");
      else if (result === "failed") setStatus("Couldn't share from this browser.");
      return;
    }
    // A computer: save the picture.
    const file = await getBeforeAfterPhoto(before, after, { spaceName, label });
    if (file && downloadBlob(file, file.name)) {
      setBusy(false);
      flash("Saved the picture. Attach it to a message or email.");
      return;
    }
    const result = await sharePlanText(title, text, navigator as ShareNavigator, false);
    setBusy(false);
    if (result === "copied") flash("Couldn't make the picture here, so the text was copied.");
    else if (result === "failed") setStatus("Couldn't save or share from this browser.");
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        data-testid="send-before-after"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 bg-white px-3.5 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 2.5 9 11M17.5 2.5 12 17.5l-3-6.5-6.5-3 15-5.5Z" />
        </svg>
        Send before and after
      </button>
      <p role="status" aria-live="polite" className="text-sm text-ink/70">
        {status}
      </p>
    </div>
  );
}
