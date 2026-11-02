"use client";

import { useEffect, useState } from "react";
import { openSavedTake } from "@/lib/client/savedTakes";
import { takeThumbSrc } from "@/lib/client/takeThumb";

/**
 * A small still from a saved take's own video, read from this device. Decorative (the row's name and
 * details say which take it is), so it is hidden from screen readers. Shows a camera outline while the
 * video loads or when the browser can't paint it.
 */
export function TakeThumb({ id, durationSec }: { id: string; durationSec: number | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    void openSavedTake(id).then((file) => {
      if (!live || !file) return;
      try {
        made = URL.createObjectURL(file);
        setUrl(made);
      } catch {
        made = null;
      }
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);

  return (
    <div
      aria-hidden="true"
      data-testid="take-thumb"
      data-painted={painted ? "yes" : "no"}
      className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-ink/5 ring-1 ring-ink/10"
    >
      {!painted && (
        <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-6 w-6 text-ink/40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 10.5 20 7v10l-5-3.5" />
          <rect x="3" y="6" width="12" height="12" rx="2" />
        </svg>
      )}
      {url && (
        <video
          src={takeThumbSrc(url, durationSec)}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          onLoadedData={() => setPainted(true)}
          onSeeked={() => setPainted(true)}
          onError={() => setPainted(false)}
          className={`h-full w-full object-cover ${painted ? "" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
