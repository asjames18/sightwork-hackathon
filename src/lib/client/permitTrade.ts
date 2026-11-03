/**
 * Work that most towns want a permit for (wiring, plumbing, gas, heating and cooling, roofing, structure,
 * sprinklers). The plan only reads the trade the model wrote on a step, so this is a nudge to ask the
 * local building office, not a ruling on what the rules are where the work happens.
 */
const PERMIT_TRADE = /electric|plumb|\bgas\b|hvac|heating|furnace|roof|structur|sprinkler|fire (alarm|protection)|asbestos/i;

export const PERMIT_CHIP_LABEL = "Permit may apply";

export const PERMIT_CHIP_HINT = "Ask your local building office whether this work needs a permit before it starts.";

/** True when a paid trade on a step usually needs a permit. Volunteers and empty trades never do. */
export function tradeMayNeedPermit(trade: string | undefined): boolean {
  const t = (trade ?? "").trim();
  if (!t || /^volunteer/i.test(t)) return false;
  return PERMIT_TRADE.test(t);
}
