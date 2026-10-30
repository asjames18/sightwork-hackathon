/**
 * Live microphone level for the in-page recorder. Pure helpers (tested offline) plus a small
 * Web Audio meter. The meter only reads the stream; it never changes what gets recorded.
 */

/** Below this level the narration is too quiet to transcribe well. */
export const QUIET_LEVEL = 0.04;
/** How long a running take can stay quiet before the hint shows. */
export const QUIET_HINT_SEC = 5;

/**
 * Loudness of one analyser frame (byte time-domain samples, 128 = silence) as 0..1.
 * RMS scaled so normal speech at arm's length reads around 0.3 to 0.7.
 */
export function levelFromSamples(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / samples.length);
  return Math.min(1, rms * 4);
}

/** Smooths the meter: rise fast so speech shows at once, fall slowly so the bar doesn't flicker. */
export function smoothLevel(prev: number, next: number): number {
  const v = next > prev ? prev + (next - prev) * 0.6 : prev + (next - prev) * 0.15;
  return Math.max(0, Math.min(1, v));
}

/**
 * Tracks how long the take has been quiet. Returns the new quiet-since time
 * (null while sound is heard) given the current level and time in seconds.
 */
export function nextQuietSince(quietSince: number | null, level: number, nowSec: number): number | null {
  if (level >= QUIET_LEVEL) return null;
  return quietSince ?? nowSec;
}

/** True once the take has been quiet for QUIET_HINT_SEC or longer. */
export function isTooQuiet(quietSince: number | null, nowSec: number): boolean {
  return quietSince !== null && nowSec - quietSince >= QUIET_HINT_SEC;
}

export interface MicMeter {
  /** Current loudness, 0..1. */
  read(): number;
  close(): void;
}

/** Opens a meter on the stream's audio track, or null when there is none or Web Audio is missing. */
export function openMicMeter(stream: MediaStream): MicMeter | null {
  if (!stream.getAudioTracks().length) return null;
  const Ctx =
    typeof window !== "undefined"
      ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!Ctx) return null;
  try {
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    ctx.resume?.().catch(() => {});
    return {
      read() {
        analyser.getByteTimeDomainData(buf);
        return levelFromSamples(buf);
      },
      close() {
        try {
          source.disconnect();
        } catch {
          /* already disconnected */
        }
        ctx.close().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}
