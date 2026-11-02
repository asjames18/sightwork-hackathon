"use client";

import { useEffect, useRef, useState } from "react";
import type { ShareNavigator } from "@/lib/client/planText";
import { downloadBlob, prefersShareSheet } from "@/lib/client/savePlanPdf";
import { saveVideoFile, saveVideoMessage } from "@/lib/client/saveVideo";

/**
 * "Save video": the phone's share sheet (iPhone offers Save Video to Photos) or a download on Android and
 * computers. `getFile` hands over the video inside the tap. Hidden in print.
 */
export function SaveVideoButton({
  getFile,
  label = "Save video",
  ariaLabel,
  className = "btn-secondary w-full text-base sm:w-auto",
}: {
  getFile: () => File | null | Promise<File | null>;
  label?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const retry = useRef(false);
  // A video read from storage is kept after the first tap, so a second tap can share at once.
  const loaded = useRef<File | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onSave() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const file = retry.current && loaded.current ? loaded.current : await getFile();
      loaded.current = file;
      if (!file) {
        setStatus("That video is no longer on this device.");
        return;
      }
      const result = await saveVideoFile(file, {
        nav: navigator as ShareNavigator,
        preferShare: prefersShareSheet(),
        download: (blob, name) => downloadBlob(blob, name),
        retry: retry.current,
      });
      retry.current = result === "needs-tap";
      const text = saveVideoMessage(result);
      setStatus(text);
      if (timer.current) clearTimeout(timer.current);
      if (text && result !== "needs-tap" && result !== "failed") timer.current = setTimeout(() => setStatus(""), 5000);
    } catch {
      setStatus(saveVideoMessage("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 print:hidden">
      <button type="button" onClick={onSave} disabled={busy} aria-label={ariaLabel} className={className}>
        {label}
      </button>
      <span role="status" aria-live="polite" className="text-sm text-ink/70">
        {status}
      </span>
    </span>
  );
}
