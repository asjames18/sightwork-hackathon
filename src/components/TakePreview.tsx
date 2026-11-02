"use client";

import { useEffect, useRef, useState } from "react";
import { openSavedTake } from "@/lib/client/savedTakes";

/**
 * Plays a saved take back inline, read from this device, so it can be checked before it's used for a
 * plan. The video URL is made when the player opens and released when it closes. Hidden in print.
 */
export function TakePreview({ id, name, onMissing }: { id: string; name: string; onMissing?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Kept in a ref so a new callback on each parent render doesn't reload the video.
  const missingRef = useRef(onMissing);
  useEffect(() => {
    missingRef.current = onMissing;
  });

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    void openSavedTake(id).then((file) => {
      if (!live) return;
      if (!file) {
        missingRef.current?.();
        return;
      }
      try {
        made = URL.createObjectURL(file);
        setUrl(made);
      } catch {
        setFailed(true);
      }
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);

  return (
    <div data-testid="take-preview" className="w-full print:hidden">
      {failed ? (
        <p role="status" className="text-sm text-ink/70">
          This browser can&apos;t play that take here. Save video still keeps it.
        </p>
      ) : (
        <video
          src={url ?? undefined}
          controls
          playsInline
          preload="metadata"
          aria-label={`Playback of ${name}`}
          onError={() => url && setFailed(true)}
          className="aspect-video max-h-[60vh] w-full rounded-xl bg-ink object-contain"
        />
      )}
    </div>
  );
}
