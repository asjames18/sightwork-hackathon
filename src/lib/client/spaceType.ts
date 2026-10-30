/**
 * What kind of space was filmed, picked on the video card (richer findings, item 3).
 * Sent with each real run as PlanRequest.spaceType (the reason, review, transcribe and cost prompts fill
 * {{space_type}} with it, so a sanctuary gets its stage-edge and AV checks) and PlanRequest.spaceName
 * (the plan's title). Kept in this browser's localStorage so a tester filming the same building picks once.
 * Pure helpers plus guarded storage; no network calls.
 */

export const SPACE_KEY = "sightwork:space";

/** Longest name sent; longer input is cut at a word. */
export const SPACE_NAME_MAX = 60;

export interface SpaceTypeOption {
  /** Stable id kept on the device. */
  id: string;
  /** Picker label. */
  label: string;
  /** What the prompts read as {{space_type}}. */
  spaceType: string;
  /** Plan title when no name is typed. */
  defaultName: string;
}

/** Picker options in menu order. "other" keeps today's generic "room". */
export const SPACE_TYPES: readonly SpaceTypeOption[] = [
  { id: "sanctuary", label: "Sanctuary", spaceType: "church sanctuary", defaultName: "Sanctuary" },
  { id: "auditorium", label: "Auditorium or stage", spaceType: "auditorium", defaultName: "Auditorium" },
  { id: "fellowship", label: "Fellowship hall", spaceType: "fellowship hall", defaultName: "Fellowship hall" },
  { id: "classroom", label: "Classroom", spaceType: "classroom", defaultName: "Classroom" },
  { id: "kitchen", label: "Kitchen", spaceType: "kitchen", defaultName: "Kitchen" },
  { id: "office", label: "Office", spaceType: "office", defaultName: "Office" },
  { id: "hallway", label: "Hallway or lobby", spaceType: "hallway or lobby", defaultName: "Hallway" },
  { id: "other", label: "Other room", spaceType: "room", defaultName: "Walkthrough" },
];

export interface SpaceChoice {
  /** SpaceTypeOption.id, or "" when nothing is picked yet. */
  typeId: string;
  /** What the tester typed; may be blank. */
  name: string;
}

export function spaceOption(typeId: string): SpaceTypeOption | undefined {
  return SPACE_TYPES.find((o) => o.id === typeId);
}

/** Collapses spaces, drops control characters, cuts at SPACE_NAME_MAX on a word. */
export function cleanSpaceName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const t = name.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= SPACE_NAME_MAX) return t;
  const cut = t.slice(0, SPACE_NAME_MAX);
  const sp = cut.lastIndexOf(" ");
  return (sp > SPACE_NAME_MAX / 2 ? cut.slice(0, sp) : cut).trim();
}

/**
 * The two request fields for a choice. Nothing picked and nothing typed sends neither, so the server
 * keeps its own defaults ("room", "Walkthrough"). A typed name with no type still names the plan.
 * Never returns a blank string (the route rejects present-but-blank labels).
 */
export function spaceRequestFields(choice: SpaceChoice | null | undefined): { spaceType?: string; spaceName?: string } {
  const opt = choice ? spaceOption(choice.typeId) : undefined;
  const name = cleanSpaceName(choice?.name ?? "");
  const out: { spaceType?: string; spaceName?: string } = {};
  if (opt) out.spaceType = opt.spaceType;
  if (name) out.spaceName = name;
  else if (opt && opt.id !== "other") out.spaceName = opt.defaultName;
  return out;
}

/** The saved choice, or blanks. Never throws (storage off, bad JSON, an id from an older build). */
export function loadSpaceChoice(): SpaceChoice {
  try {
    if (typeof window === "undefined") return { typeId: "", name: "" };
    const raw = window.localStorage.getItem(SPACE_KEY);
    if (!raw) return { typeId: "", name: "" };
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return { typeId: "", name: "" };
    const o = v as Record<string, unknown>;
    const typeId = typeof o.typeId === "string" && spaceOption(o.typeId) ? o.typeId : "";
    const name = typeof o.name === "string" ? o.name.slice(0, SPACE_NAME_MAX * 2) : "";
    return { typeId, name };
  } catch {
    return { typeId: "", name: "" };
  }
}

/** Saves the choice; both blank clears it. */
export function saveSpaceChoice(choice: SpaceChoice): void {
  try {
    const typeId = spaceOption(choice.typeId) ? choice.typeId : "";
    const name = choice.name.slice(0, SPACE_NAME_MAX * 2);
    if (!typeId && !name.trim()) window.localStorage.removeItem(SPACE_KEY);
    else window.localStorage.setItem(SPACE_KEY, JSON.stringify({ typeId, name }));
  } catch {
    /* storage off: the choice just isn't remembered */
  }
}

/** Request fields from what is saved on this device right now (read when a run starts). */
export function savedSpaceRequestFields(): { spaceType?: string; spaceName?: string } {
  return spaceRequestFields(loadSpaceChoice());
}
