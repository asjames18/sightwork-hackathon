/**
 * Pulls the stereo AAC narration track out of a phone video (QuickTime .mov or MP4) and rewraps it
 * as a small audio-only MP4 that every browser's decodeAudioData accepts. No re-encoding: the AAC
 * frames are copied as they are.
 *
 * Why: iPhone camera videos are QuickTime files whose AAC track uses a version 1 sound sample
 * description (esds inside a 'wave' box). iOS Safari's decodeAudioData refuses those, and iPhone 16
 * and later also add an Apple Spatial Audio ('apac') track, sometimes listed before the AAC one, which
 * Chromium picks and can't decode. Either way the whole-file decode threw and the take went without
 * narration. In-page recordings are plain MP4/WebM and never hit this.
 *
 * Only box headers, the moov box and the audio samples are read, so a 140 MB video costs about
 * 1 MB of reads instead of loading the whole file into memory.
 */

/** Reads bytes [start, end) of the source. Browsers pass a Blob reader; tests pass a Buffer one. */
export type ByteReader = (start: number, end: number) => Promise<Uint8Array>;

export interface AacTrack {
  trackId: number;
  enabled: boolean;
  alternateGroup: number;
  timescale: number;
  channels: number;
  sampleRate: number;
  /** The esds box payload (version/flags + ES descriptor), copied as is. */
  esds: Uint8Array;
  /** Raw stts payload (entries after version/flags/count) kept as [count, delta] pairs. */
  stts: [number, number][];
  sampleSizes: number[];
  sampleOffsets: number[];
}

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf"]);

/** Biggest moov this will read (iPhone moov boxes are 40-70 KB for a minute of video). */
export const MAX_MOOV_BYTES = 32 * 1024 * 1024;
/** Most audio bytes this will copy (90 s of 48 kHz stereo AAC is about 1.5 MB). */
export const MAX_AUDIO_BYTES = 48 * 1024 * 1024;

export function blobReader(blob: Blob): ByteReader {
  return async (start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

function fourcc(b: Uint8Array, at: number): string {
  return String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);
}

interface Box {
  type: string;
  /** Offset of the payload (after the header) inside the buffer. */
  start: number;
  /** Offset just past the box. */
  end: number;
}

function children(b: Uint8Array, start: number, end: number): Box[] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Box[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = v.getUint32(p);
    const type = fourcc(b, p + 4);
    let hdr = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = Number(v.getBigUint64(p + 8));
      hdr = 16;
    } else if (size === 0) size = end - p;
    if (size < hdr || p + size > end) break;
    out.push({ type, start: p + hdr, end: p + size });
    p += size;
  }
  return out;
}

function find(b: Uint8Array, box: Box, type: string): Box | undefined {
  return children(b, box.start, box.end).find((c) => c.type === type);
}

function path(b: Uint8Array, box: Box | undefined, ...types: string[]): Box | undefined {
  let cur = box;
  for (const t of types) cur = cur && find(b, cur, t);
  return cur;
}

/** Finds the moov box by walking top-level headers only (mdat is skipped, never read). */
export async function readMoov(read: ByteReader, fileSize: number): Promise<Uint8Array | null> {
  let p = 0;
  let sawFtyp = false;
  while (p + 8 <= fileSize) {
    const h = await read(p, Math.min(fileSize, p + 16));
    if (h.length < 8) return null;
    const v = new DataView(h.buffer, h.byteOffset, h.byteLength);
    let size = v.getUint32(0);
    const type = fourcc(h, 4);
    let hdr = 8;
    if (p === 0 && type !== "ftyp") return null; // not an ISO/QuickTime file
    if (type === "ftyp") sawFtyp = true;
    if (size === 1) {
      if (h.length < 16) return null;
      size = Number(v.getBigUint64(8));
      hdr = 16;
    } else if (size === 0) size = fileSize - p;
    if (size < hdr) return null;
    if (type === "moov") {
      if (!sawFtyp || size > MAX_MOOV_BYTES || p + size > fileSize) return null;
      const box = await read(p, p + size);
      // Rebase so callers see the moov payload at a known offset with an 8-byte header.
      if (hdr === 16) {
        const out = new Uint8Array(size - 8);
        out.set(box.subarray(16), 8);
        new DataView(out.buffer).setUint32(0, out.length);
        out.set([0x6d, 0x6f, 0x6f, 0x76], 4);
        return out;
      }
      return box;
    }
    p += size;
  }
  return null;
}

function soundEntryAudio(b: Uint8Array, entry: Box): { channels: number; sampleRate: number; childStart: number } {
  // entry.start points after the 8-byte header: 6 reserved + 2 data ref index + sound fields.
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const base = entry.start + 8;
  const version = v.getUint16(base);
  let channels = v.getUint16(base + 8);
  let sampleRate = v.getUint32(base + 16) >>> 16;
  let childStart = base + 20;
  if (version === 1) childStart += 16;
  else if (version === 2) {
    sampleRate = Math.round(v.getFloat64(base + 24));
    channels = v.getUint32(base + 32);
    childStart = base + 56;
  }
  return { channels, sampleRate, childStart };
}

function findEsds(b: Uint8Array, start: number, end: number, depth = 0): Uint8Array | null {
  for (const c of children(b, start, end)) {
    if (c.type === "esds") return b.slice(c.start, c.end);
    if (depth < 2 && (c.type === "wave" || c.type === "mp4a")) {
      // 'wave' holds frma/mp4a/esds; an inner 'mp4a' atom here is a 4-byte stub, not a sample entry.
      const inner = findEsds(b, c.start, c.end, depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

/** Every AAC ('mp4a') sound track in the moov, in file order. */
export function aacTracks(moov: Uint8Array): AacTrack[] {
  const v = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  const root: Box = { type: "moov", start: 8, end: moov.length };
  const out: AacTrack[] = [];
  for (const trak of children(moov, root.start, root.end).filter((c) => c.type === "trak")) {
    const hdlr = path(moov, trak, "mdia", "hdlr");
    if (!hdlr || fourcc(moov, hdlr.start + 8) !== "soun") continue;
    const stbl = path(moov, trak, "mdia", "minf", "stbl");
    const stsd = stbl && find(moov, stbl, "stsd");
    if (!stbl || !stsd) continue;
    const entry = children(moov, stsd.start + 8, stsd.end)[0];
    if (!entry || entry.type !== "mp4a") continue;
    const { channels, sampleRate, childStart } = soundEntryAudio(moov, entry);
    const esds = findEsds(moov, childStart, entry.end);
    if (!esds) continue;

    const tkhd = find(moov, trak, "tkhd");
    let enabled = true;
    let trackId = 0;
    let alternateGroup = 0;
    if (tkhd) {
      const ver = moov[tkhd.start];
      enabled = (v.getUint32(tkhd.start) & 1) === 1;
      trackId = v.getUint32(tkhd.start + (ver === 1 ? 20 : 12));
      alternateGroup = v.getUint16(tkhd.start + (ver === 1 ? 46 : 34));
    }
    const mdhd = path(moov, trak, "mdia", "mdhd");
    const timescale = mdhd ? v.getUint32(mdhd.start + (moov[mdhd.start] === 1 ? 20 : 12)) : sampleRate;

    const stts: [number, number][] = [];
    const sttsBox = find(moov, stbl, "stts");
    if (sttsBox) {
      const n = v.getUint32(sttsBox.start + 4);
      for (let i = 0; i < n; i++) stts.push([v.getUint32(sttsBox.start + 8 + i * 8), v.getUint32(sttsBox.start + 12 + i * 8)]);
    }
    const stszBox = find(moov, stbl, "stsz");
    const sampleSizes: number[] = [];
    if (stszBox) {
      const fixed = v.getUint32(stszBox.start + 4);
      const n = v.getUint32(stszBox.start + 8);
      for (let i = 0; i < n; i++) sampleSizes.push(fixed || v.getUint32(stszBox.start + 12 + i * 4));
    }
    const chunkOffsets: number[] = [];
    const stco = find(moov, stbl, "stco");
    const co64 = find(moov, stbl, "co64");
    if (stco) {
      const n = v.getUint32(stco.start + 4);
      for (let i = 0; i < n; i++) chunkOffsets.push(v.getUint32(stco.start + 8 + i * 4));
    } else if (co64) {
      const n = v.getUint32(co64.start + 4);
      for (let i = 0; i < n; i++) chunkOffsets.push(Number(v.getBigUint64(co64.start + 8 + i * 8)));
    }
    const stsc = find(moov, stbl, "stsc");
    const runs: [number, number][] = [];
    if (stsc) {
      const n = v.getUint32(stsc.start + 4);
      for (let i = 0; i < n; i++) runs.push([v.getUint32(stsc.start + 8 + i * 12), v.getUint32(stsc.start + 12 + i * 12)]);
    }
    // Expand stsc runs to one offset per sample.
    const sampleOffsets: number[] = [];
    let s = 0;
    for (let c = 0; c < chunkOffsets.length && s < sampleSizes.length; c++) {
      let perChunk = 0;
      for (const [first, count] of runs) if (first <= c + 1) perChunk = count;
      let off = chunkOffsets[c];
      for (let k = 0; k < perChunk && s < sampleSizes.length; k++, s++) {
        sampleOffsets.push(off);
        off += sampleSizes[s];
      }
    }
    if (sampleOffsets.length !== sampleSizes.length || sampleSizes.length === 0) continue;
    out.push({ trackId, enabled, alternateGroup, timescale, channels, sampleRate, esds, stts, sampleSizes, sampleOffsets });
  }
  return out;
}

/**
 * The track to use: the first enabled AAC track (in an iPhone alternate group that is the stereo
 * fallback for the Spatial Audio track), else the first AAC track.
 */
export function pickAacTrack(tracks: AacTrack[]): AacTrack | null {
  return tracks.find((t) => t.enabled) ?? tracks[0] ?? null;
}

// ---- writer ----

function u32(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}
function u16(n: number): number[] {
  return [(n >>> 8) & 255, n & 255];
}
function str(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}
function box(type: string, ...parts: (number[] | Uint8Array)[]): Uint8Array {
  const len = 8 + parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  out.set(u32(len), 0);
  out.set(str(type), 4);
  let p = 8;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
const MATRIX = [...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];

/** Writes ftyp + moov + mdat for one AAC track whose samples are laid out back to back in mdat. */
export function writeAudioMp4(track: AacTrack, samples: Uint8Array): Uint8Array {
  const duration = track.stts.reduce((n, [c, d]) => n + c * d, 0);
  const ftyp = box("ftyp", str("M4A "), u32(0), str("M4A "), str("isom"), str("mp42"));
  const mvhd = box("mvhd", u32(0), u32(0), u32(0), u32(track.timescale), u32(duration), u32(0x10000), u16(0x100), new Array(10).fill(0), MATRIX, new Array(24).fill(0), u32(2));
  const tkhd = box("tkhd", u32(3), u32(0), u32(0), u32(1), u32(0), u32(duration), new Array(8).fill(0), u16(0), u16(0), u16(0x100), u16(0), MATRIX, u32(0), u32(0));
  const mdhd = box("mdhd", u32(0), u32(0), u32(0), u32(track.timescale), u32(duration), u16(0x55c4), u16(0));
  const hdlr = box("hdlr", u32(0), u32(0), str("soun"), new Array(12).fill(0), str("SoundHandler"), [0]);
  const esds = box("esds", track.esds);
  const mp4a = box("mp4a", new Array(6).fill(0), u16(1), new Array(8).fill(0), u16(track.channels || 2), u16(16), u16(0), u16(0), u32(((track.sampleRate || 48000) & 0xffff) * 0x10000), esds);
  const stsd = box("stsd", u32(0), u32(1), mp4a);
  const stts = box("stts", u32(0), u32(track.stts.length), track.stts.flatMap(([c, d]) => [...u32(c), ...u32(d)]));
  const stsc = box("stsc", u32(0), u32(1), u32(1), u32(track.sampleSizes.length), u32(1));
  const sizes = new Uint8Array(12 + track.sampleSizes.length * 4);
  const sv = new DataView(sizes.buffer);
  sv.setUint32(8, track.sampleSizes.length);
  track.sampleSizes.forEach((n, i) => sv.setUint32(12 + i * 4, n));
  const stsz = box("stsz", sizes);
  const smhd = box("smhd", u32(0), u16(0), u16(0));
  const dinf = box("dinf", box("dref", u32(0), u32(1), box("url ", u32(1))));
  // stco holds the mdat payload offset, which depends on moov's own size: build once with 0, then patch.
  const build = (mdatStart: number) => {
    const stco = box("stco", u32(0), u32(1), u32(mdatStart));
    const stbl = box("stbl", stsd, stts, stsc, stsz, stco);
    const minf = box("minf", smhd, dinf, stbl);
    const mdia = box("mdia", mdhd, hdlr, minf);
    const trak = box("trak", tkhd, mdia);
    return box("moov", mvhd, trak);
  };
  const moovLen = build(0).length;
  const moov = build(ftyp.length + moovLen + 8);
  const mdatHeader = new Uint8Array([...u32(8 + samples.length), ...str("mdat")]);
  const out = new Uint8Array(ftyp.length + moov.length + mdatHeader.length + samples.length);
  out.set(ftyp, 0);
  out.set(moov, ftyp.length);
  out.set(mdatHeader, ftyp.length + moov.length);
  out.set(samples, ftyp.length + moov.length + mdatHeader.length);
  return out;
}

/** Copies the track's samples out of the source, merging contiguous runs into one read each. */
export async function readSamples(read: ByteReader, track: AacTrack): Promise<Uint8Array> {
  const total = track.sampleSizes.reduce((a, b) => a + b, 0);
  if (total > MAX_AUDIO_BYTES) throw new Error("audio track too large");
  const out = new Uint8Array(total);
  let w = 0;
  let i = 0;
  while (i < track.sampleSizes.length) {
    const start = track.sampleOffsets[i];
    let end = start + track.sampleSizes[i];
    let j = i + 1;
    while (j < track.sampleSizes.length && track.sampleOffsets[j] === end) end += track.sampleSizes[j++];
    const bytes = await read(start, end);
    if (bytes.length !== end - start) throw new Error("short read");
    out.set(bytes, w);
    w += bytes.length;
    i = j;
  }
  return out;
}

/**
 * The narration track of a .mov/.mp4 as a small audio-only MP4, or null when the file isn't an
 * ISO/QuickTime file or has no AAC track (the caller then decodes the file as it is).
 */
export async function audioOnlyMp4(read: ByteReader, fileSize: number): Promise<Uint8Array | null> {
  const moov = await readMoov(read, fileSize);
  if (!moov) return null;
  const track = pickAacTrack(aacTracks(moov));
  if (!track) return null;
  return writeAudioMp4(track, await readSamples(read, track));
}
