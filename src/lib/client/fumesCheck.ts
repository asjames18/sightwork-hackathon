/**
 * A reminder for steps that use paint, primer, stain, finish, solvent, adhesive or epoxy: fumes build up in a closed room.
 * It only reads the words the plan wrote on a step, so it is a nudge to plan fresh air, not a health assessment.
 */
export const FUMES_LABEL = "Ventilate while working";
export const FUMES_HINT =
  "Open windows or run a fan so fresh air moves through, keep lids on cans when you step away, and read the product label for the gloves or mask it asks for.";

/** Old paint and old stains are things the plan found, not products the crew opens. */
const FOUND_NOT_USED = /\b(peeling|chipping|chipped|flaking|cracked|bubbling|old|lead|existing|water|moisture|rust)[- ](stained |colored )?(paint|stains?|finish)\b|\b(paint|finish|stain)(ed)? (is |was )?(peeling|chipping|flaking|bubbling)\b|\bstain(s|ed)?[- ]?(free|spots?|marks?)\b/gi;
const FUME_WORK = /\b(paint(ing)?|primer|priming|prime (and|then|the|all|each|walls?|ceilings?)|stain(ing)? (the |all |new |each )?(wood|deck|floors?|fence|trim|cabinets?|doors?|walls?)|varnish(ing)?|polyurethane|lacquer|shellac|sealer|sealing the (floor|concrete|deck|wood|grout)|refinish(ing)?|solvents?|mineral spirits|paint thinner|adhesive|contact cement|construction glue|epoxy|strip(ping)? (the )?(old )?(finish|varnish|paint)|degreaser|spray foam)\b/i;

/** True when a step's own words use a product that gives off fumes. */
export function usesFumeProduct(step: { title?: string; detail?: string }): boolean {
  const text = `${step.title ?? ""}. ${step.detail ?? ""}`.replace(FOUND_NOT_USED, " ");
  if (!text.trim()) return false;
  return FUME_WORK.test(text);
}
