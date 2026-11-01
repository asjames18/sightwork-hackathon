/**
 * Which plan section is "on screen" for the sticky chip row.
 * A section is current once its top has scrolled up to the line just under the sticky header and chips.
 * Before the first section reaches that line nothing is current; at the very bottom of the page the last
 * section wins, so a short final section (like Cost) can still be marked.
 */
export type SectionTop = { id: string; top: number };

export function activeSection(sections: SectionTop[], line: number, atBottom = false): string | null {
  if (sections.length === 0) return null;
  if (atBottom) return sections[sections.length - 1].id;
  let current: string | null = null;
  for (const s of sections) {
    if (s.top <= line + 1) current = s.id;
    else break;
  }
  return current;
}

/** How far to scroll the chip row so the current chip sits fully inside it, with a small margin. 0 means leave it. */
export function chipScrollDelta(chip: { left: number; right: number }, row: { left: number; right: number }, margin = 16): number {
  if (chip.left < row.left + margin) return chip.left - row.left - margin;
  if (chip.right > row.right - margin) return chip.right - row.right + margin;
  return 0;
}
