/**
 * Length rules for the walkthrough video, by how big the space is (2026-10-31, Antonio). This file is the
 * one source of truth for every length the app states or enforces: the room size picker, the guidance on
 * the upload screen, the in-app recorder (wrap-up hint, countdown and automatic stop) and the length check
 * on a picked video. Pure (no browser APIs), so tools/test can check it.
 *
 * Why size, not one fixed length: a bedroom is covered in well under a minute, while a gym or a warehouse
 * needs minutes for a slow, steady pass (inspection and insurance guides tie length to the space, e.g.
 * about a minute per 300 sq ft). Frame selection does not change with size: the take still sends at most
 * 48 frames, spread over the clip (one every 2 s, evenly spread once that would pass 48), so a 5-minute
 * take gets about one frame every 6.4 s. Narration past about 80 s is sent to /api/transcribe in chunks
 * (narrationChunks.ts), so every size's cap fits the 4.5 MB request limit.
 */

export type RoomSize = "small" | "medium" | "large" | "xl";

export interface DurationRules {
  size: RoomSize;
  /** Picker label, e.g. "Small". */
  label: string;
  /** Plain examples of spaces this size, e.g. "Bedroom, office, bathroom". */
  examples: string;
  /** Recommended length range in seconds. */
  aimMinSec: number;
  aimMaxSec: number;
  /** Past this the upload check warns and the recorder says to wrap up. */
  warnAfterSec: number;
  /** Past this a picked video is blocked; the recorder stops by itself here. */
  hardMaxSec: number;
  /** Shorter than this is blocked (same for every size). */
  minSec: number;
}

/** Shortest take for any size. */
export const MIN_SEC = 5;

export const ROOM_SIZES: readonly DurationRules[] = [
  { size: "small", label: "Small", examples: "Bedroom, office, bathroom", aimMinSec: 30, aimMaxSec: 60, warnAfterSec: 60, hardMaxSec: 75, minSec: MIN_SEC },
  { size: "medium", label: "Medium", examples: "Classroom, kitchen, stage", aimMinSec: 60, aimMaxSec: 90, warnAfterSec: 95, hardMaxSec: 120, minSec: MIN_SEC },
  { size: "large", label: "Large", examples: "Sanctuary, gym, big hall", aimMinSec: 90, aimMaxSec: 180, warnAfterSec: 150, hardMaxSec: 180, minSec: MIN_SEC },
  { size: "xl", label: "Extra large", examples: "Warehouse, whole floor, parking lot", aimMinSec: 180, aimMaxSec: 300, warnAfterSec: 270, hardMaxSec: 300, minSec: MIN_SEC },
];

/** Medium keeps roughly the old fixed rules (60 to 90 s, warn past 95 s). */
export const DEFAULT_ROOM_SIZE: RoomSize = "medium";

/** Longest take any size allows (the Extra large cap). */
export const LONGEST_TAKE_SEC = Math.max(...ROOM_SIZES.map((r) => r.hardMaxSec));

export function isRoomSize(v: unknown): v is RoomSize {
  return typeof v === "string" && ROOM_SIZES.some((r) => r.size === v);
}

/** The rules for a size; anything unknown (or nothing) gets Medium. */
export function durationRulesFor(size?: string | null): DurationRules {
  return ROOM_SIZES.find((r) => r.size === size) ?? (ROOM_SIZES.find((r) => r.size === DEFAULT_ROOM_SIZE) as DurationRules);
}

/** Short length for labels: "75 s", "90 s", "2 min", "5 min" (whole minutes from 2 min up). */
export function shortLength(sec: number): string {
  return sec >= 120 && sec % 60 === 0 ? `${sec / 60} min` : `${sec} s`;
}

/** Spoken length for sentences: "60 seconds", "90 seconds", "2 minutes", "2½ minutes". */
export function spokenLength(sec: number): string {
  if (sec < 120) return `${sec} seconds`;
  const min = sec / 60;
  if (Number.isInteger(min)) return `${min} minutes`;
  if (sec % 30 === 0) return `${Math.floor(min)}½ minutes`;
  return `${sec} seconds`;
}

/** The recommended range: "30–60 s", "90 s–3 min", "3–5 min". */
export function aimRange(r: DurationRules): string {
  const a = shortLength(r.aimMinSec);
  const b = shortLength(r.aimMaxSec);
  const unit = (s: string) => s.split(" ")[1];
  return unit(a) === unit(b) ? `${a.split(" ")[0]}–${b}` : `${a}–${b}`;
}

/** Spoken range: "30 to 60 seconds", "90 seconds to 3 minutes", "3 to 5 minutes". */
export function aimRangeSpoken(r: DurationRules): string {
  const a = spokenLength(r.aimMinSec);
  const b = spokenLength(r.aimMaxSec);
  const unit = (s: string) => s.split(" ")[1];
  return unit(a) === unit(b) ? `${a.split(" ")[0]} to ${b}` : `${a} to ${b}`;
}

/** The guidance line for a size: "Aim for 30–60 s, stops at 75 s". */
export function aimText(r: DurationRules): string {
  return `Aim for ${aimRange(r)}, stops at ${shortLength(r.hardMaxSec)}`;
}

export type Check =
  | { kind: "reading" }
  | { kind: "ok"; durationSec: number }
  | { kind: "warn"; durationSec: number; message: string }
  | { kind: "block"; message: string };

/** Plain-language verdict on a picked video's length for the chosen room size. Pure, so it can be checked without a browser. */
export function checkDuration(durationSec: number, size?: string | null): Check {
  const r = durationRulesFor(size);
  const space = `${r.label.toLowerCase()} space`;
  if (!Number.isFinite(durationSec) || durationSec <= 0)
    return { kind: "block", message: "We couldn't read this video's length. Try recording again, or pick an MP4." };
  if (durationSec < r.minSec)
    return { kind: "block", message: `That clip is only a few seconds. Walk the whole space for ${aimRangeSpoken(r)}.` };
  if (durationSec > r.hardMaxSec) {
    const bigger = ROOM_SIZES.find((s) => s.hardMaxSec >= durationSec);
    const hint = bigger
      ? ` If the space is bigger, pick ${bigger.label} as the room size.`
      : " For a space this big, film one walkthrough per area.";
    const trim = r.aimMaxSec < r.hardMaxSec ? `Trim it to about ${spokenLength(r.aimMaxSec)}` : `Trim it to under ${spokenLength(r.hardMaxSec)}`;
    return {
      kind: "block",
      message: `That video is over ${spokenLength(r.hardMaxSec)}, the most for a ${space}. ${trim}, or record a shorter walkthrough.${hint}`,
    };
  }
  if (durationSec > r.warnAfterSec)
    return { kind: "warn", durationSec, message: `A bit long for a ${space}. It will still work, but ${aimRangeSpoken(r)} gives the sharpest plan.` };
  return { kind: "ok", durationSec };
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
