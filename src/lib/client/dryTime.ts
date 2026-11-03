/**
 * A reminder for steps that put on something wet: paint, primer, caulk, grout, mortar, sealer, joint compound, patch or poured concrete.
 * It only reads the words the plan wrote on a step, so it is a nudge to leave time before the next step, not a drying schedule.
 */
export const DRY_LABEL = "Needs time to dry";
export const DRY_HINT =
  "Leave this to dry or cure before the next step or before anyone walks on it, and read the product label for how long that takes.";

/** Old paint, old caulk and old stains are things the plan found, not products the crew puts on. */
const FOUND_NOT_USED = /\b(peeling|chipping|chipped|flaking|cracked|bubbling|old|lead|existing|failed|missing|water|moisture|rust)[- ](stained |colored )?(paint|stains?|finish|caulk|grout|mortar)\b|\b(paint|finish|stain|caulk|grout|mortar)(ed)? (is |was )?(peeling|chipping|flaking|bubbling|cracked|missing)\b|\bstain(s|ed)?[- ]?(free|spots?|marks?)\b|\b(remove|scrape|strip|scrub|clean off|clean up)( the| all| any)?( old)? (paint|caulk|grout|stains?)\b/gi;
const WET_WORK = /\b(paint(ing)?|primer|priming|prime (and|then|the|all|each|walls?|ceilings?)|caulk(ing)?|re-?caulk(ing)?|grout(ing)?|re-?grout(ing)?|thin-?set|(re-?)?mortar(ing)?|tuck-?point(ing)?|joint compound|tape and mud|skim coat|plaster(ing)?|patch(es|ing)? (the |a |each |all )?(holes?|cracks?|walls?|ceiling|concrete|drywall|plaster|slab|floor)|pour(s|ing)? (a |the )?(concrete|slab|footing|patch)|concrete patch|sealer|seal(s|ing) the (floor|concrete|deck|wood|grout|driveway|roof|joints?|seams?)|stain(ing)? (the |all |new |each )?(wood|deck|floors?|fence|trim|cabinets?|doors?|walls?)|varnish(ing)?|polyurethane|lacquer|shellac|epoxy|roof cement|silicone sealant)\b/i;

/** True when a step's own words put on a product that has to dry or cure. */
export function needsDryTime(step: { title?: string; detail?: string }): boolean {
  const text = `${step.title ?? ""}. ${step.detail ?? ""}`.replace(FOUND_NOT_USED, " ");
  if (!text.trim()) return false;
  return WET_WORK.test(text);
}
