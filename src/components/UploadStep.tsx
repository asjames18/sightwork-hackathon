"use client";

import { useRef, useState } from "react";

export function UploadStep({ onVideo, onExample }: { onVideo: (file: File) => void; onExample: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);

  return (
    <section>
      <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Film a walkthrough. Get a work plan.</h1>
      <p className="mt-3 text-ink/70">
        Walk the space for 60 to 90 seconds and say what needs work. SightWork counts what&apos;s there, finds the problems
        (including the ones you didn&apos;t mention), and lays out the work in order.
      </p>

      <input
        ref={input}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (preview) URL.revokeObjectURL(preview.url);
          setPreview({ url: URL.createObjectURL(file), file });
        }}
      />

      {!preview ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-8 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink/25 bg-white px-6 py-10 text-center active:scale-[.99]"
        >
          <span aria-hidden className="text-4xl">🎥</span>
          <span className="text-lg font-semibold">Record or choose a video</span>
          <span className="text-sm text-ink/60">MP4 or MOV, up to about 90 seconds</span>
        </button>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
          <video src={preview.url} controls playsInline className="aspect-video w-full bg-black" />
          <div className="flex items-center justify-between gap-3 p-4">
            <p className="truncate text-sm text-ink/70">{preview.file.name}</p>
            <button type="button" onClick={() => input.current?.click()} className="shrink-0 text-sm font-medium underline">
              Change
            </button>
          </div>
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={() => onVideo(preview.file)}
              className="w-full rounded-xl bg-ink px-5 py-4 text-lg font-semibold text-white active:scale-[.99]"
            >
              Make my work plan
            </button>
            <p className="mt-2 text-center text-xs text-ink/50">
              Preview build: your video stays on this device and an example plan is shown.
            </p>
          </div>
        </div>
      )}

      <button type="button" onClick={onExample} className="mt-6 w-full text-center text-sm font-medium text-accent underline">
        See an example plan first
      </button>
    </section>
  );
}
