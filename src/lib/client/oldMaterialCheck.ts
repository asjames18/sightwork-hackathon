/**
 * A reminder for steps that scrape, sand or tear out old surfaces: a building from before about 1980 can
 * hide lead paint or asbestos, and the time to find out is before the dust is made. It only reads the
 * words the plan wrote on a step, so it is a nudge to get the material tested, not a safety procedure.
 */
export const OLD_MATERIAL_LABEL = "Check for lead or asbestos";
export const OLD_MATERIAL_HINT =
  "A building from before about 1980 can hide lead paint or asbestos. Have it tested before this step scrapes, sands or tears anything out.";

/** Work that makes dust from paint on its own, wherever it is written. */
const PAINT_DUST = /\b(scrap(e|es|ed|ing)|sand(ing|ed)?|grind(ing)?|chip(ping)?|strip(ping|ped)? (the |off |old )?(paint|finish|coating))\b/i;
/** Work that pulls out or breaks up an old material. */
const TEAR_OUT = /\b(demolish|demolition|tear(ing)? (it |them )?out|torn out|pull(ing)? down|pull(ing)? up|rip(ping)? (out|up)|knock(ing)? (down|out)|take(s|n)? down|remov(e|es|ed|ing|al)|haul(ing)? out|break(ing)? up)\b/i;
const OLD_MATERIAL = /\b(plaster|lath|popcorn|textured ceiling|ceiling tiles?|floor(ing)? tiles?|vinyl|linoleum|old paint|insulation|siding|pipe wrap|joint compound|drywall mud)\b/i;
/** Not dust work: sand as a material, sanding a new patch or fresh wood. */
const NOT_THAT = /\bsand ?bag|\bsand(ed)? (finish|texture)\b|\bnew (wood|lumber)\b/i;

/** True when the words of a step describe disturbing old paint, plaster, tile, insulation or similar. */
export function disturbsOldMaterial(step: { title?: string; detail?: string }): boolean {
  const text = `${step.title ?? ""}. ${step.detail ?? ""}`;
  if (!text.trim() || NOT_THAT.test(text)) return false;
  if (PAINT_DUST.test(text)) return true;
  return TEAR_OUT.test(text) && OLD_MATERIAL.test(text);
}
