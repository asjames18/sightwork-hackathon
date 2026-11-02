/**
 * Previous / Next for the full-size proof photo. Proof photos in one list (the problems, or the
 * "Worth a closer look" list) share a group name on their photo buttons, so the open photo can step
 * to the one before or after it without closing and finding the next card. Only photos that are on
 * the page right now count (a filtered-out problem or a closed section is skipped), and stepping stops
 * at the ends instead of wrapping, so "Photo 5 of 5" always means the last one.
 */

/** Where the open photo sits in its group, or null when it isn't in one (or is the only one). */
export type ProofNavPos = { index: number; count: number };

/** Position of `current` among `triggers`, or null when there is nothing to step to. */
export function proofNavPos<T>(triggers: readonly T[], current: T | null | undefined): ProofNavPos | null {
  if (!current) return null;
  const index = triggers.indexOf(current);
  if (index < 0 || triggers.length < 2) return null;
  return { index, count: triggers.length };
}

/** The index a step lands on, or null at either end (no wrap). */
export function proofNavTarget(pos: ProofNavPos | null, dir: -1 | 1): number | null {
  if (!pos) return null;
  const next = pos.index + dir;
  return next >= 0 && next < pos.count ? next : null;
}

/** Visible position, like "Photo 2 of 5". */
export function proofNavLabel(pos: ProofNavPos): string {
  return `Photo ${pos.index + 1} of ${pos.count}`;
}

/** Group photo buttons that are on the page right now, in page order. */
export function proofTriggers(group: string, doc: Pick<Document, "querySelectorAll"> | undefined = typeof document === "undefined" ? undefined : document): HTMLElement[] {
  if (!doc || !group) return [];
  const all = Array.from(doc.querySelectorAll<HTMLElement>(`[data-proof-group="${CSS.escape(group)}"]`));
  return all.filter((el) => el.getClientRects().length > 0);
}
