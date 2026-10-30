import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aacTracks, audioOnlyMp4, pickAacTrack, readMoov, type AacTrack, type ByteReader } from "@/lib/client/movAudio";

const FIX = join(import.meta.dirname, "..", "..", "e2e", "fixtures");
const load = (name: string) => new Uint8Array(readFileSync(join(FIX, name)));

/** Reader over a buffer that counts how many bytes were asked for. */
function counting(bytes: Uint8Array): { read: ByteReader; total: () => number } {
  let n = 0;
  return {
    read: async (s, e) => {
      n += e - s;
      return bytes.slice(s, e);
    },
    total: () => n,
  };
}

const ascii = (b: Uint8Array, at: number, len = 4) => String.fromCharCode(...b.subarray(at, at + len));
function indexOf(b: Uint8Array, s: string, from = 0): number {
  outer: for (let i = from; i + s.length <= b.length; i++) {
    for (let j = 0; j < s.length; j++) if (b[i + j] !== s.charCodeAt(j)) continue outer;
    return i;
  }
  return -1;
}

test("a QuickTime .mov (version 1 sound entry, esds inside 'wave') is rewrapped as a plain M4A", async () => {
  const src = load("speech-6s.mov");
  const out = await audioOnlyMp4(counting(src).read, src.length);
  assert.ok(out);
  assert.equal(ascii(out, 4), "ftyp");
  assert.equal(ascii(out, 8), "M4A ");
  const mp4a = indexOf(out, "mp4a");
  assert.ok(mp4a > 0);
  const view = new DataView(out.buffer, out.byteOffset);
  // Sound sample entry version 0 (iOS Safari only decodes version 0) with esds as a direct child.
  assert.equal(view.getUint16(mp4a + 4 + 8), 0);
  assert.equal(ascii(out, mp4a + 4 + 28 + 4), "esds");
  assert.equal(indexOf(out, "wave"), -1);
  // One audio track only (no video, no Spatial Audio track).
  assert.equal(indexOf(out, "vide"), -1);
  assert.equal(out.length - indexOf(out, "mdat") - 4, aacTracks((await readMoov(counting(src).read, src.length))!)[0].sampleSizes.reduce((a, b) => a + b, 0));
});

test("the AAC samples are copied byte for byte, and stco points at them", async () => {
  const src = load("speech-6s.mov");
  const moov = await readMoov(counting(src).read, src.length);
  const track = aacTracks(moov!)[0];
  const out = (await audioOnlyMp4(counting(src).read, src.length))!;
  const stco = indexOf(out, "stco");
  const dataAt = new DataView(out.buffer, out.byteOffset).getUint32(stco + 12);
  assert.equal(ascii(out, dataAt - 4), "mdat");
  let w = dataAt;
  for (let i = 0; i < track.sampleSizes.length; i++) {
    const a = src.subarray(track.sampleOffsets[i], track.sampleOffsets[i] + track.sampleSizes[i]);
    assert.deepEqual(out.subarray(w, w + a.length), a, `sample ${i}`);
    w += a.length;
  }
  assert.equal(w, out.length);
  assert.equal(track.sampleRate, 48000);
  assert.equal(track.channels, 2);
  assert.equal(track.timescale, 48000);
});

test("a sound track that isn't AAC listed first (like iPhone's Spatial Audio 'apac') is skipped", async () => {
  const src = load("speech-6s-apac-first.mov");
  const moov = await readMoov(counting(src).read, src.length);
  const all = aacTracks(moov!);
  assert.equal(all.length, 1);
  assert.equal(all[0].sampleRate, 48000);
  const out = await audioOnlyMp4(counting(src).read, src.length);
  assert.ok(out);
  assert.equal(indexOf(out, "apac"), -1);
});

test("an enabled AAC track wins over a disabled one; otherwise the first AAC track", () => {
  const t = (trackId: number, enabled: boolean) => ({ trackId, enabled }) as AacTrack;
  assert.equal(pickAacTrack([t(2, false), t(3, true)])?.trackId, 3);
  assert.equal(pickAacTrack([t(3, false)])?.trackId, 3); // iPhone with apac first: AAC fallback is disabled
  assert.equal(pickAacTrack([]), null);
});

test("only the moov and the audio are read, not the whole video", async () => {
  const src = load("speech-6s-apac-first.mov");
  const r = counting(src);
  await audioOnlyMp4(r.read, src.length);
  assert.ok(r.total() < src.length, `${r.total()} of ${src.length}`);
});

test("WebM recordings and fragmented MP4 (no sample tables) return null so the whole file is decoded as before", async () => {
  for (const name of ["clip-3s.webm", "speech-6s-fragmented.mp4"]) {
    const src = load(name);
    assert.equal(await audioOnlyMp4(counting(src).read, src.length), null, name);
  }
});

test("truncated or garbage input returns null or throws, never hangs", async () => {
  const src = load("speech-6s.mov");
  const cut = src.slice(0, src.length - 500);
  const r = await audioOnlyMp4(counting(cut).read, cut.length).catch(() => "threw");
  assert.ok(r === null || r === "threw");
  const junk = new Uint8Array(4096).fill(7);
  assert.equal(await audioOnlyMp4(counting(junk).read, junk.length), null);
});
