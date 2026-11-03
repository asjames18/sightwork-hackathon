/**
 * How fast "Read it to me" speaks: three steps a person can pick, kept on this device.
 * The number is the browser speech rate, where 1 is the voice's normal pace.
 */
export const READ_SPEEDS = ["slower", "normal", "faster"] as const;
export type ReadSpeed = (typeof READ_SPEEDS)[number];

export const READ_SPEED_KEY = "sightwork:readSpeed:v1";

const RATE: Record<ReadSpeed, number> = { slower: 0.8, normal: 1, faster: 1.25 };

export function isReadSpeed(value: unknown): value is ReadSpeed {
  return typeof value === "string" && (READ_SPEEDS as readonly string[]).includes(value);
}

/** Anything unreadable or unknown falls back to normal. */
export function parseReadSpeed(raw: unknown): ReadSpeed {
  return isReadSpeed(raw) ? raw : "normal";
}

export function readSpeedRate(speed: ReadSpeed): number {
  return RATE[speed];
}

/** The speed one press moves to: normal, then faster, then slower, then back to normal. */
export function nextReadSpeed(speed: ReadSpeed): ReadSpeed {
  return speed === "normal" ? "faster" : speed === "faster" ? "slower" : "normal";
}

export function readSpeedName(speed: ReadSpeed): string {
  return speed === "slower" ? "Slower" : speed === "faster" ? "Faster" : "Normal";
}

/** Button words: says where you are, so the next press is no surprise. */
export function readSpeedLabel(speed: ReadSpeed): string {
  return `Speed: ${readSpeedName(speed)}`;
}

/** Screen-reader announcement after a press. A reading already under way keeps its pace, so say so. */
export function readSpeedStatus(speed: ReadSpeed, reading = false): string {
  const base = `Reading speed set to ${readSpeedName(speed).toLowerCase()}.`;
  return reading ? `${base} It starts with the next reading.` : base;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // storage blocked (private mode, strict settings)
  }
}

export function loadReadSpeed(s: Store | null = store()): ReadSpeed {
  try {
    return parseReadSpeed(s?.getItem(READ_SPEED_KEY));
  } catch {
    return "normal";
  }
}

export function saveReadSpeed(speed: ReadSpeed, s: Store | null = store()): void {
  try {
    if (speed === "normal") s?.removeItem(READ_SPEED_KEY);
    else s?.setItem(READ_SPEED_KEY, speed);
  } catch {
    // full or blocked: the speed still applies for this visit
  }
}
