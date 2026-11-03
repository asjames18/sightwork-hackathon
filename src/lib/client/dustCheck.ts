/**
 * A reminder for steps that cut, sand, grind, chisel or hang drywall: flying chips and fine dust are normal on that work.
 * It only reads the words the plan wrote on a step, so it is a nudge to bring eye and dust protection, not a safety procedure.
 */
export const DUST_LABEL = "Eyes and dust mask";
export const DUST_HINT =
  "Wear safety glasses and a dust mask for this step, and keep anyone who is not working on it out of the room while it is cut, sanded or broken up.";

/** Shutting off a supply or trimming a budget is not cutting material. */
const NOT_CUTTING = /\bcut(s|ting)? (off|out the (power|water|gas)|the (power|water|gas|electricity|breaker)|costs?|back on|down on)\b|\bshortcut\b|\bsand ?bags?\b/gi;
const DUST_WORK = /\b(cut(s|ting)?|saw(s|ing|ed)?|sand(s|ing|ed)?|grind(s|ing)?|chisel(s|ing|ed)?|jackhammer(s|ing)?|demolition|demolish(es|ing)?|tuck-?point(ing)?|re-?mortar(ing)?|drywall|sheetrock|tape and mud|joint compound|drill(s|ing)? (in)?to (the )?(concrete|brick|masonry|stone|block|tile)|break(s|ing)? up (the )?(concrete|tile|slab))\b/i;

/** True when a step's own words cut, sand, grind or break up material. */
export function makesDust(step: { title?: string; detail?: string }): boolean {
  const text = `${step.title ?? ""}. ${step.detail ?? ""}`.replace(NOT_CUTTING, " ");
  if (!text.trim()) return false;
  return DUST_WORK.test(text);
}
