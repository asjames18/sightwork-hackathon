import type { TranscriptTurn } from "@/lib/types";
import { bytesToBase64, REQUEST_OVERHEAD_BYTES } from "./buildPlanRequest";

/**
 * Narration chunking for long takes (2026-10-31, room size lengths up to 5 minutes). Pure logic, no DOM,
 * no network, so tools/test can check it.
 *
 * The narration goes to POST /api/transcribe as a 16 kHz mono 16-bit WAV in base64, about 42.7 KB per
 * second. A hosted request tops out near 4.5 MB (the budget is 4.3 MB), so one request holds only about
 * 100 s of sound. Longer narration is cut into chunks of at most NARRATION_CHUNK_MAX_SEC; each cut goes
 * at the quietest 50 ms in the last CUT_SEARCH_SEC before the limit (a pause between words, so no word is
 * split), each chunk is its own transcribe request, and the answers are joined with every turn shifted
 * by where its chunk starts, so the transcript times still line up with the video (the "Along your walk"
 * timeline and the said/never-mentioned matching read them). Each chunk is far under Meta transcribe's
 * per-file limits (10 minutes, 32 MB). Nothing server-side changes: the route sees ordinary short WAVs.
 */

/** Longest chunk in seconds (3.4 MB of base64 at 16 kHz, well under the 4.3 MB request budget). */
export const NARRATION_CHUNK_MAX_SEC = 80;
/** How far back from the limit to look for a quiet place to cut. */
export const CUT_SEARCH_SEC = 12;
/** Window for measuring how quiet a moment is. */
export const QUIET_WINDOW_SEC = 0.05;
/** Peak below this (out of 32767, about the isSilent 0.003 level) means a chunk has no sound worth sending. */
export const SILENT_PEAK = 98;

/** Longest chunk that fits a request of maxRequestBytes (with framing and 10% headroom), capped at NARRATION_CHUNK_MAX_SEC. */
export function narrationChunkMaxSec(maxRequestBytes: number, sampleRate = 16000): number {
  const rawBytes = ((maxRequestBytes - REQUEST_OVERHEAD_BYTES) * 0.9 * 3) / 4 - 44;
  const fit = Math.floor(rawBytes / (2 * sampleRate));
  return Math.max(10, Math.min(NARRATION_CHUNK_MAX_SEC, fit));
}

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataBytes: number;
}

/** Reads a RIFF/WAVE header (fmt and data chunks). Null for anything that isn't a PCM WAV. */
export function readWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 44) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (off: number) => String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let off = 12;
  let fmt: Omit<WavInfo, "dataOffset" | "dataBytes"> | null = null;
  while (off + 8 <= bytes.length) {
    const id = tag(off);
    const size = v.getUint32(off + 4, true);
    if (id === "fmt " && off + 24 <= bytes.length) {
      if (v.getUint16(off + 8, true) !== 1) return null; // PCM only
      fmt = { channels: v.getUint16(off + 10, true), sampleRate: v.getUint32(off + 12, true), bitsPerSample: v.getUint16(off + 22, true) };
    } else if (id === "data") {
      if (!fmt) return null;
      return { ...fmt, dataOffset: off + 8, dataBytes: Math.min(size, bytes.length - off - 8) };
    }
    off += 8 + size + (size % 2);
  }
  return null;
}

/**
 * Sample indices where the chunks start and end: [0, cut1, ..., n]. A take that fits one chunk gets
 * [0, n]. Each cut is the centre of the quietest QUIET_WINDOW_SEC window in the CUT_SEARCH_SEC before
 * the chunk limit (never in the chunk's first half), so every chunk is at most maxChunkSec long.
 */
export function planChunkCuts(pcm: Int16Array, sampleRate: number, maxChunkSec = NARRATION_CHUNK_MAX_SEC, searchSec = CUT_SEARCH_SEC): number[] {
  const n = pcm.length;
  const maxLen = Math.max(1, Math.floor(maxChunkSec * sampleRate));
  const win = Math.max(1, Math.round(QUIET_WINDOW_SEC * sampleRate));
  const step = Math.max(1, Math.floor(win / 2));
  const cuts = [0];
  let pos = 0;
  while (n - pos > maxLen) {
    const hi = pos + maxLen;
    const lo = Math.max(pos + Math.floor(maxLen / 2), hi - Math.floor(searchSec * sampleRate));
    let best = hi;
    let bestEnergy = Infinity;
    // Latest quietest window wins ties, so chunks stay as long as allowed.
    for (let s = lo; s + win <= hi; s += step) {
      let e = 0;
      for (let i = s; i < s + win; i++) e += Math.abs(pcm[i]);
      if (e <= bestEnergy) {
        bestEnergy = e;
        best = s + Math.floor(win / 2);
      }
    }
    if (best <= pos) best = hi;
    cuts.push(best);
    pos = best;
  }
  cuts.push(n);
  return cuts;
}

export interface NarrationChunk {
  /** Where the chunk starts in the take, in seconds. */
  startSec: number;
  durationSec: number;
  wavBase64: string;
  /** No sound worth sending (all under SILENT_PEAK): the caller skips the request. */
  silent: boolean;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A mono 16-bit PCM WAV of the given samples (same header as buildPlanRequest's encodeWav). */
export function pcmToWav(pcm: Int16Array, sampleRate: number): Uint8Array {
  const dataBytes = pcm.length * 2;
  const out = new Uint8Array(44 + dataBytes);
  const v = new DataView(out.buffer);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i);
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i], true);
  return out;
}

/**
 * Splits a base64 narration WAV into chunks of at most maxChunkSec, cut at quiet points. Null when it
 * needs no split (it fits one chunk) or isn't a mono 16-bit PCM WAV, so the caller sends it whole as before.
 */
export function splitNarrationWav(wavBase64: string, maxChunkSec = NARRATION_CHUNK_MAX_SEC): NarrationChunk[] | null {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(wavBase64);
  } catch {
    return null;
  }
  const info = readWav(bytes);
  if (!info || info.channels !== 1 || info.bitsPerSample !== 16 || !(info.sampleRate > 0)) return null;
  const count = Math.floor(info.dataBytes / 2);
  if (count <= maxChunkSec * info.sampleRate) return null;
  const pcm = new Int16Array(count);
  const v = new DataView(bytes.buffer, bytes.byteOffset + info.dataOffset, count * 2);
  for (let i = 0; i < count; i++) pcm[i] = v.getInt16(i * 2, true);
  const cuts = planChunkCuts(pcm, info.sampleRate, maxChunkSec);
  const chunks: NarrationChunk[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const part = pcm.subarray(cuts[k], cuts[k + 1]);
    let peak = 0;
    for (let i = 0; i < part.length; i++) {
      const a = Math.abs(part[i]);
      if (a > peak) peak = a;
    }
    chunks.push({
      startSec: cuts[k] / info.sampleRate,
      durationSec: part.length / info.sampleRate,
      wavBase64: bytesToBase64(pcmToWav(part, info.sampleRate)),
      silent: peak < SILENT_PEAK,
    });
  }
  return chunks;
}

export interface ChunkTranscript {
  /** The chunk's start in the take, in seconds. */
  offsetSec: number;
  transcript: string | null;
  transcriptTurns: TranscriptTurn[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One "[12.3] text" line shifted by offsetSec; lines without a leading time stay as they are. */
export function shiftTranscriptLine(line: string, offsetSec: number): string {
  const m = /^\[(\d+(?:\.\d+)?)\](.*)$/.exec(line);
  if (!m) return line;
  return `[${(Number(m[1]) + offsetSec).toFixed(1)}]${m[2]}`;
}

/**
 * Joins chunk answers into one, in take time: every turn's startSec and endSec, and every "[sec]" line
 * in the transcript text, moves by its chunk's offset. Chunks with no speech add nothing; no speech in
 * any chunk gives null, like a single request for a quiet take.
 */
export function stitchChunkTranscripts(parts: ChunkTranscript[]): { transcript: string | null; transcriptTurns: TranscriptTurn[] } {
  const ordered = [...parts].sort((a, b) => a.offsetSec - b.offsetSec);
  const lines: string[] = [];
  const turns: TranscriptTurn[] = [];
  for (const p of ordered) {
    if (p.transcript && p.transcript.trim()) {
      for (const line of p.transcript.split("\n")) if (line.trim()) lines.push(shiftTranscriptLine(line, p.offsetSec));
    }
    for (const t of p.transcriptTurns) {
      turns.push({
        ...t,
        startSec: round2(t.startSec + p.offsetSec),
        ...(t.endSec !== undefined ? { endSec: round2(t.endSec + p.offsetSec) } : {}),
      });
    }
  }
  const transcript = lines.length ? lines.join("\n") : null;
  return { transcript, transcriptTurns: transcript ? turns : [] };
}
