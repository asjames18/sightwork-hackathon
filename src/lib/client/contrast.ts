/**
 * Contrast for the plan screen: normal, or high for bright rooms and low vision. Kept on this device.
 * High contrast is a data attribute on the page root; the stylesheet does the rest.
 */
export const CONTRASTS = ["normal", "high"] as const;
export type Contrast = (typeof CONTRASTS)[number];

export const CONTRAST_KEY = "sightwork:contrast:v1";

export function isContrast(value: unknown): value is Contrast {
  return typeof value === "string" && (CONTRASTS as readonly string[]).includes(value);
}

/** Anything unreadable or unknown falls back to normal. */
export function parseContrast(raw: unknown): Contrast {
  return isContrast(raw) ? raw : "normal";
}

/** One press flips between the two. */
export function nextContrast(c: Contrast): Contrast {
  return c === "normal" ? "high" : "normal";
}

export function contrastName(c: Contrast): string {
  return c === "high" ? "High" : "Normal";
}

/** Button words: says where you are, so the next press is no surprise. */
export function contrastLabel(c: Contrast): string {
  return `Contrast: ${contrastName(c)}`;
}

/** Screen-reader announcement after a press. */
export function contrastStatus(c: Contrast): string {
  return `Contrast set to ${contrastName(c).toLowerCase()}.`;
}

/** The value for the root's data-contrast attribute, or "" to leave the page alone. */
export function contrastAttr(c: Contrast): string {
  return c === "high" ? "high" : "";
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // storage blocked (private mode, strict settings)
  }
}

export function loadContrast(s: Store | null = store()): Contrast {
  try {
    return parseContrast(s?.getItem(CONTRAST_KEY));
  } catch {
    return "normal";
  }
}

export function saveContrast(c: Contrast, s: Store | null = store()): void {
  try {
    if (c === "normal") s?.removeItem(CONTRAST_KEY);
    else s?.setItem(CONTRAST_KEY, c);
  } catch {
    // full or blocked: the setting still applies for this visit
  }
}
