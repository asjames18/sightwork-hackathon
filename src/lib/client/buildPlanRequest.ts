import type { LaborBasis, PlanRequest } from "@/lib/types";
import type { BuildPlanRequest } from "./apiPlanJob";

/**
 * Browser-side request builder: turns the picked walkthrough video into a PlanRequest
 * (still frames as JPEG data URLs plus the narration as mono 16-bit PCM WAV).
 * No network calls. Everything runs on the device, so the video itself never leaves it.
 */

export interface BuildOptions {
  spaceName?: string;
  spaceType?: string;
  region?: string;
  laborBasis?: LaborBasis;
  /** Most frames to send. Default 48 (under the 50-images-per-request limit). */
  maxFrames?: number;
  /** Seconds between frames before the cap spreads them out. Default 2. */
  intervalSec?: number;
  /** Longest frame side in px. Default 1024. */
  longSide?: number;
  /** Narration sample rate. Default 16000. */
  audioSampleRate?: number;
  /** Total request budget in bytes (the route caps at 10 MB). Default 9 MB, leaving room for JSON. */
  maxRequestBytes?: number;
}

const DEFAULTS = {
  maxFrames: 48,
  intervalSec: 2,
  longSide: 1024,
  audioSampleRate: 16000,
  maxRequestBytes: 9 * 1024 * 1024,
};

/** JPEG qualities tried in order until a frame fits its share of the budget. */
const QUALITIES = [0.72, 0.55, 0.4];

export class BuildRequestError extends Error {}

/**
 * Frame times: one every intervalSec, spread evenly over the video when that would pass
 * maxFrames. Stays 0.25 s off both ends so seeks land on a decodable frame.
 */
export function pickFrameTimes(durationSec: number, maxFrames = DEFAULTS.maxFrames, intervalSec = DEFAULTS.intervalSec): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || maxFrames < 1) return [];
  const start = Math.min(0.25, durationSec / 2);
  const end = Math.max(start, durationSec - 0.25);
  const span = end - start;
  const byInterval = Math.floor(span / Math.max(intervalSec, 0.1)) + 1;
  const n = Math.max(1, Math.min(maxFrames, byInterval));
  if (n === 1) return [round2(start + span / 2)];
  return Array.from({ length: n }, (_, i) => round2(start + (span * i) / (n - 1)));
}

/** Width and height scaled so the longer side is at most longSide (never upscaled). */
export function fitSize(w: number, h: number, longSide = DEFAULTS.longSide): { w: number; h: number } {
  const scale = Math.min(1, longSide / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** Averages channels into one. */
export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** Mono float samples to a 16-bit PCM WAV file (RIFF/WAVE, little-endian). */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

/** True when the samples are all near-silent (no usable narration). */
export function isSilent(samples: Float32Array, threshold = 0.003): boolean {
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]) > threshold) return false;
  return true;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}

function loadVideo(url: string, signal: AbortSignal): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    video.onloadeddata = () => {
      signal.removeEventListener("abort", onAbort);
      resolve(video);
    };
    video.onerror = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new BuildRequestError("This video couldn't be opened. Try an MP4 or MOV from your phone."));
    };
    video.src = url;
  });
}

function seek(video: HTMLVideoElement, t: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const done = () => {
      video.removeEventListener("seeked", done);
      clearTimeout(timer);
      resolve();
    };
    // Some browsers skip "seeked" for a no-op seek; don't hang on it.
    const timer = setTimeout(done, 4000);
    video.addEventListener("seeked", done);
    video.currentTime = t;
  });
}

/** Decodes the file's audio track to mono at sampleRate. Null when there's no usable audio. */
async function extractNarration(file: File, sampleRate: number, signal: AbortSignal): Promise<Uint8Array | null> {
  const Ctx: typeof AudioContext | undefined =
    typeof window !== "undefined" ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
  if (!Ctx || typeof OfflineAudioContext === "undefined") return null;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    return null; // no audio track, or a codec the browser can't decode
  } finally {
    void ctx.close();
  }
  checkAbort(signal);
  const length = Math.max(1, Math.ceil(decoded.duration * sampleRate));
  const offline = new OfflineAudioContext(1, length, sampleRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination); // the destination is mono, so this downmixes
  src.start();
  const rendered = await offline.startRendering();
  checkAbort(signal);
  const mono = downmix([rendered.getChannelData(0)]);
  return isSilent(mono) ? null : encodeWav(mono, sampleRate);
}

/** Encodes the canvas at the highest quality that fits maxChars. */
function encodeFrame(canvas: HTMLCanvasElement, maxChars: number): string {
  let url = "";
  for (const q of QUALITIES) {
    url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= maxChars) return url;
  }
  return url;
}

/**
 * Makes the BuildPlanRequest that createApiPlanJob takes. Narration is pulled first so the
 * frames get whatever is left of the request budget, split evenly.
 */
export function createBuildPlanRequest(options: BuildOptions = {}): BuildPlanRequest {
  const o = { ...DEFAULTS, ...options };
  return async (file, signal) => {
    checkAbort(signal);
    const url = URL.createObjectURL(file);
    try {
      const video = await loadVideo(url, signal);
      const durationSec = video.duration;
      if (!Number.isFinite(durationSec) || durationSec <= 0)
        throw new BuildRequestError("This video has no length we can read. Try recording it again.");

      const wav = await extractNarration(file, o.audioSampleRate, signal);
      const audioWavBase64 = wav ? bytesToBase64(wav) : undefined;

      const times = pickFrameTimes(durationSec, o.maxFrames, o.intervalSec);
      const frameBudget = o.maxRequestBytes - (audioWavBase64?.length ?? 0) - 64 * 1024;
      if (frameBudget < times.length * 20 * 1024)
        throw new BuildRequestError("That video is too long to send. Try a walkthrough of 90 seconds or less.");
      const perFrame = Math.floor(frameBudget / times.length);

      const { w, h } = fitSize(video.videoWidth, video.videoHeight, o.longSide);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d");
      if (!g) throw new BuildRequestError("This browser can't read video frames. Try Chrome or Safari.");

      const frames: PlanRequest["frames"] = [];
      for (const t of times) {
        await seek(video, t, signal);
        g.drawImage(video, 0, 0, w, h);
        frames.push({ tSec: t, dataUrl: encodeFrame(canvas, perFrame) });
      }
      video.removeAttribute("src");
      video.load();

      return {
        spaceName: o.spaceName,
        spaceType: o.spaceType,
        durationSec: round2(durationSec),
        frames,
        audioWavBase64,
        region: o.region,
        laborBasis: o.laborBasis,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  };
}
