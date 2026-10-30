import type { LaborBasis, PlanRequest } from "@/lib/types";
import type { BuildPlanRequest } from "./apiPlanJob";
import { assignZones, frameSignature, SIGNATURE_SIDE, type FrameSignature } from "./zones";
import { trimFramesCoveringZones } from "./zoneCoverage";
import { resolveVideoDuration } from "./videoDuration";
import { BLANK_SIDE, BLANK_TAKE_MESSAGE, isBlankTake, lumaStats, type LumaStats } from "./blankTake";
import { chooseSharpTick, frameSharpness, isSoftTick, scoreSize, tickCandidates } from "./sharpTick";
import { normalizeNarration } from "./narrationLevel";
import { audioOnlyMp4, blobReader } from "./movAudio";
import { mergeByTime, planDenseTicks, sceneChangeTimes } from "./denseSampling";

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
  /**
   * Narration sample rate. Default 16000. Meta's transcribe step only takes mono 16-bit WAV at
   * 16000 or 24000 Hz (8000 gets a 400, checked 2026-10-28), so any other value falls back to 16000.
   */
  audioSampleRate?: number;
  /**
   * Total request budget in bytes (the route caps at 10 MB). Default 9 MB, leaving room for JSON.
   * Hosts with a smaller platform cap pass less; see requestBudgetBytes.
   */
  maxRequestBytes?: number;
  /**
   * Group the take into zones and send each frame's zoneId (proposal B). Default true. Off, or when
   * the browser can't read pixels back, frames go without zoneId and the pipeline sees one zone.
   */
  zones?: boolean;
  /**
   * When a frame tick looks soft next to the rest of the take, try a couple of seek times near it
   * (about 0.3 s either side) and send the sharpest, so a tick that lands mid-turn doesn't send a
   * smeared frame. Default true. Frame
   * count, spacing and size don't change. Off, or when pixels can't be read, each tick is sent as is.
   */
  sharpFrames?: boolean;
  /**
   * Denser frames for takes up to 45 s (about one per 1.25 s, plus up to 4 frames where the picture
   * changes fast), inside the byte budget and the 48-frame cap; see denseSampling.ts. Default true.
   * Off, or when the budget can't fit them, the take keeps one frame every intervalSec.
   */
  denseFrames?: boolean;
  /**
   * Read when each run starts, for fields the person picks on the video card (space type and name).
   * Defined values win over the fixed options above.
   */
  runContext?: () => Partial<Pick<BuildOptions, "spaceName" | "spaceType" | "region" | "laborBasis">>;
}

const DEFAULTS = {
  maxFrames: 48,
  intervalSec: 2,
  longSide: 1024,
  audioSampleRate: 16000,
  maxRequestBytes: 9 * 1024 * 1024,
  zones: true,
  sharpFrames: true,
  denseFrames: true,
};

/** Smallest and largest request budgets requestBudgetBytes accepts (1 MB to the 9 MB default). */
export const MIN_REQUEST_BYTES = 1024 * 1024;
export const MAX_REQUEST_BYTES = DEFAULTS.maxRequestBytes;

/**
 * Request budget from a build-time setting (NEXT_PUBLIC_SIGHTWORK_MAX_REQUEST_BYTES). Hosts with a
 * smaller body cap than the route's 10 MB (Vercel Functions take 4.5 MB) set it so long takes get
 * softer frames that fit, or the friendly "too long" message, instead of a platform 413. Blank,
 * non-numeric, fractional or out-of-range values keep the 9 MB default.
 */
export function requestBudgetBytes(raw: string | undefined): number {
  const text = raw?.trim() ?? "";
  if (!/^\d+$/.test(text)) return DEFAULTS.maxRequestBytes;
  const n = Number(text);
  return n >= MIN_REQUEST_BYTES && n <= MAX_REQUEST_BYTES ? n : DEFAULTS.maxRequestBytes;
}

/** Sample rates the transcribe step accepts. */
export const TRANSCRIBE_SAMPLE_RATES = [16000, 24000] as const;

/** The requested narration rate when transcribe accepts it, otherwise 16000. */
export function narrationSampleRate(requested: number | undefined): number {
  return (TRANSCRIBE_SAMPLE_RATES as readonly number[]).includes(requested as number) ? (requested as number) : 16000;
}

/** JPEG qualities tried in order until a frame fits its share of the budget. */
const QUALITIES = [0.72, 0.55, 0.4];

/** A video problem the person can act on; its message is shown to them as is. */
export class BuildRequestError extends Error {
  override name = "BuildRequestError";
}

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
  let decoded: AudioBuffer | null = null;
  try {
    // Phone videos (.mov/.mp4): decode just the AAC track, rewrapped as a plain audio MP4. iOS
    // Safari refuses the iPhone camera's QuickTime sound entry, and Chromium trips on an iPhone
    // Spatial Audio track listed first, so the whole-file decode below loses the narration there.
    const audioOnly = await audioOnlyMp4(blobReader(file), file.size).catch(() => null);
    checkAbort(signal);
    if (audioOnly) decoded = await ctx.decodeAudioData(audioOnly.buffer as ArrayBuffer).catch(() => null);
    // In-page recordings (WebM), other containers, or a rewrap that didn't decode: the file as it is.
    if (!decoded) decoded = await ctx.decodeAudioData(await file.arrayBuffer()).catch(() => null);
  } finally {
    void ctx.close();
  }
  if (!decoded) return null; // no audio track, or a codec the browser can't decode
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
  return isSilent(mono) ? null : encodeWav(normalizeNarration(mono), sampleRate);
}

/**
 * Adds zoneId to each frame when there's one signature per frame. Anything else (zones off, a
 * browser that refused getImageData) leaves the frames as they are.
 */
export function withZoneIds(frames: PlanRequest["frames"], signatures: (FrameSignature | null)[]): PlanRequest["frames"] {
  if (frames.length === 0 || signatures.length !== frames.length || signatures.some((s) => s === null)) return frames;
  const ids = assignZones(signatures as FrameSignature[]);
  return frames.map((f, i) => ({ ...f, zoneId: ids[i] }));
}

/** Small RGBA thumbnail of the current canvas, signed for zone grouping. Null if pixels can't be read. */
function signCanvas(source: HTMLCanvasElement, thumb: CanvasRenderingContext2D | null): FrameSignature | null {
  if (!thumb) return null;
  try {
    thumb.drawImage(source, 0, 0, SIGNATURE_SIDE, SIGNATURE_SIDE);
    const { data } = thumb.getImageData(0, 0, SIGNATURE_SIDE, SIGNATURE_SIDE);
    return frameSignature(data, SIGNATURE_SIDE, SIGNATURE_SIDE);
  } catch {
    return null;
  }
}

/** Brightness stats of the canvas on a tiny copy; null if pixels can't be read. */
function measureLuma(source: HTMLCanvasElement, g: CanvasRenderingContext2D | null): LumaStats | null {
  if (!g) return null;
  try {
    g.drawImage(source, 0, 0, BLANK_SIDE, BLANK_SIDE);
    return lumaStats(g.getImageData(0, 0, BLANK_SIDE, BLANK_SIDE).data, BLANK_SIDE, BLANK_SIDE);
  } catch {
    return null;
  }
}

/** Sharpness of the current canvas measured on a small copy; null if pixels can't be read. */
function scoreCanvas(source: HTMLCanvasElement, small: CanvasRenderingContext2D | null, w: number, h: number): number | null {
  if (!small) return null;
  try {
    small.drawImage(source, 0, 0, w, h);
    const { data } = small.getImageData(0, 0, w, h);
    return frameSharpness(data, w, h);
  } catch {
    return null;
  }
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
  const base = { ...DEFAULTS, ...options };
  return async (file, signal) => {
    checkAbort(signal);
    const ctx = base.runContext?.() ?? {};
    const o = { ...base };
    for (const k of ["spaceName", "spaceType", "region", "laborBasis"] as const) if (ctx[k] !== undefined) (o as Record<string, unknown>)[k] = ctx[k];
    const url = URL.createObjectURL(file);
    try {
      const video = await loadVideo(url, signal);
      // In-page recordings (WebM from MediaRecorder) carry no duration header until scanned.
      const durationSec = await resolveVideoDuration(video);
      checkAbort(signal);
      if (!Number.isFinite(durationSec) || durationSec <= 0)
        throw new BuildRequestError("This video has no length we can read. Try recording it again.");

      // A file the browser can play as sound but not decode as picture (some HEVC phone videos on
      // desktop Chrome) reports a 0x0 size, which would send blank frames to the model.
      if (!video.videoWidth || !video.videoHeight)
        throw new BuildRequestError("This browser can't show this video's picture. Try Safari, or export it as an MP4 and try again.");

      const wav = await extractNarration(file, narrationSampleRate(o.audioSampleRate), signal);
      const audioWavBase64 = wav ? bytesToBase64(wav) : undefined;

      const legacyTimes = pickFrameTimes(durationSec, o.maxFrames, o.intervalSec);
      if (legacyTimes.length === 0)
        throw new BuildRequestError("This video has no length we can read. Try recording it again.");
      const frameBudget = o.maxRequestBytes - (audioWavBase64?.length ?? 0) - 64 * 1024;
      if (frameBudget < legacyTimes.length * 20 * 1024)
        throw new BuildRequestError("That video is too long to send. Try a walkthrough of 90 seconds or less.");
      const dense = o.denseFrames ? planDenseTicks(durationSec, { frameBudgetBytes: frameBudget, legacyCount: legacyTimes.length, maxFrames: o.maxFrames }) : null;
      const times = dense?.times ?? legacyTimes;
      const sceneSlots = dense && o.zones ? dense.sceneSlots : 0;
      const perFrame = Math.floor(frameBudget / (times.length + sceneSlots));

      const { w, h } = fitSize(video.videoWidth, video.videoHeight, o.longSide);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d");
      if (!g) throw new BuildRequestError("This browser can't read video frames. Try Chrome or Safari.");

      let thumb: CanvasRenderingContext2D | null = null;
      if (o.zones) {
        const tc = document.createElement("canvas");
        tc.width = SIGNATURE_SIDE;
        tc.height = SIGNATURE_SIDE;
        thumb = tc.getContext("2d", { willReadFrequently: true });
      }

      // Sharper frames: score each candidate on a small copy, keep the best full-size draw in `best`.
      let small: CanvasRenderingContext2D | null = null;
      let best: HTMLCanvasElement | null = null;
      let bestG: CanvasRenderingContext2D | null = null;
      const ss = scoreSize(w, h);
      if (o.sharpFrames) {
        const sc = document.createElement("canvas");
        sc.width = ss.w;
        sc.height = ss.h;
        small = sc.getContext("2d", { willReadFrequently: true });
        best = document.createElement("canvas");
        best.width = w;
        best.height = h;
        bestG = best.getContext("2d");
      }

      // Blank take check on a tiny copy of each sent frame (see blankTake.ts).
      const lc = document.createElement("canvas");
      lc.width = BLANK_SIDE;
      lc.height = BLANK_SIDE;
      const lumaG = lc.getContext("2d", { willReadFrequently: true });
      const lumas: (LumaStats | null)[] = [];

      let frames: PlanRequest["frames"] = [];
      const signatures: (FrameSignature | null)[] = [];
      const tickScores: number[] = [];
      for (let ti = 0; ti < times.length; ti++) {
        const t = times[ti];
        await seek(video, t, signal);
        g.drawImage(video, 0, 0, w, h);
        let out = canvas;
        let tSec = t;
        if (small && best && bestG) {
          const own = scoreCanvas(canvas, small, ss.w, ss.h) ?? NaN;
          const candidates = dense ? dense.candidates[ti] : tickCandidates(t, durationSec);
          if (candidates.length > 1 && isSoftTick(own, tickScores)) {
            // Soft tick: keep its draw, try the neighbours, and send whichever is clearly sharper.
            bestG.drawImage(canvas, 0, 0);
            const scores = [own];
            let kept = chooseSharpTick(scores);
            for (const c of candidates.slice(1)) {
              await seek(video, c, signal);
              g.drawImage(video, 0, 0, w, h);
              scores.push(scoreCanvas(canvas, small, ss.w, ss.h) ?? NaN);
              const pick = chooseSharpTick(scores);
              // The pick only ever moves to the newest candidate; copy it before the next seek.
              if (pick !== kept && pick === scores.length - 1) bestG.drawImage(canvas, 0, 0);
              kept = pick;
            }
            out = best;
            tSec = candidates[kept < 0 ? 0 : kept];
          }
          tickScores.push(own);
        }
        lumas.push(measureLuma(out, lumaG));
        frames.push({ tSec, dataUrl: encodeFrame(out, perFrame) });
        if (o.zones) signatures.push(signCanvas(out, thumb));
      }
      if (isBlankTake(lumas)) throw new BuildRequestError(BLANK_TAKE_MESSAGE);
      // Scene-change frames: one more angle halfway between ticks where the picture jumps (dense takes only).
      if (sceneSlots > 0 && signatures.length === frames.length) {
        const extraTimes = sceneChangeTimes(frames.map((f) => f.tSec), signatures, sceneSlots);
        const extra: { frame: PlanRequest["frames"][number]; sig: FrameSignature | null; tSec: number }[] = [];
        for (const t of extraTimes) {
          await seek(video, t, signal);
          g.drawImage(video, 0, 0, w, h);
          extra.push({ frame: { tSec: t, dataUrl: encodeFrame(canvas, perFrame) }, sig: signCanvas(canvas, thumb), tSec: t });
        }
        if (extra.length) {
          const merged = mergeByTime(
            frames.map((frame, i) => ({ frame, sig: signatures[i], tSec: frame.tSec })),
            extra,
          );
          frames = merged.map((m) => m.frame);
          signatures.splice(0, signatures.length, ...merged.map((m) => m.sig));
        }
      }
      if (o.zones) frames = withZoneIds(frames, signatures);
      // Guard: never send more than maxFrames, and if anything ever has to go, every zone keeps a frame.
      frames = trimFramesCoveringZones(frames, Math.max(1, o.maxFrames));
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
