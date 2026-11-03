/**
 * Text size for the plan screen: three steps a person can pick for themselves, kept on this device.
 * Everything is sized in rem, so changing the page's base size scales the whole plan together.
 */
export const TEXT_SIZES = ["normal", "large", "xlarge"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const TEXT_SIZE_KEY = "sightwork:textSize:v1";

/** Base font size as a percentage of the browser's own default (so the person's system setting still counts). */
const PERCENT: Record<TextSize, number> = { normal: 100, large: 115, xlarge: 130 };

export function isTextSize(value: unknown): value is TextSize {
  return typeof value === "string" && (TEXT_SIZES as readonly string[]).includes(value);
}

/** Anything unreadable or unknown falls back to normal. */
export function parseTextSize(raw: unknown): TextSize {
  return isTextSize(raw) ? raw : "normal";
}

export function textSizePercent(size: TextSize): number {
  return PERCENT[size];
}

/** The size one press moves to; after the biggest it wraps back to normal. */
export function nextTextSize(size: TextSize): TextSize {
  const i = TEXT_SIZES.indexOf(size);
  return TEXT_SIZES[(i + 1) % TEXT_SIZES.length];
}

export function textSizeName(size: TextSize): string {
  return size === "normal" ? "Normal" : size === "large" ? "Large" : "Extra large";
}

/** Button words: says where you are, so the next press is no surprise. */
export function textSizeLabel(size: TextSize): string {
  return `Text size: ${textSizeName(size)}`;
}

/** Screen-reader announcement after a press. */
export function textSizeStatus(size: TextSize): string {
  return `Text size set to ${textSizeName(size).toLowerCase()}.`;
}

/** The CSS font-size for the page's root, or "" to leave the browser's own size alone. */
export function textSizeCss(size: TextSize): string {
  return size === "normal" ? "" : `${PERCENT[size]}%`;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // storage blocked (private mode, strict settings)
  }
}

export function loadTextSize(s: Store | null = store()): TextSize {
  try {
    return parseTextSize(s?.getItem(TEXT_SIZE_KEY));
  } catch {
    return "normal";
  }
}

export function saveTextSize(size: TextSize, s: Store | null = store()): void {
  try {
    if (size === "normal") s?.removeItem(TEXT_SIZE_KEY);
    else s?.setItem(TEXT_SIZE_KEY, size);
  } catch {
    // full or blocked: the size still applies for this visit
  }
}
