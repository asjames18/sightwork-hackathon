/**
 * A reminder for paid trades that work on a live supply: the power, the water or the gas should be shut
 * off at its source before anyone opens a wall or a fixture. It only reads the trade the plan wrote on a
 * step, so it is a nudge to ask the trade, not a safety procedure for the building.
 */
export interface ShutOffNote {
  label: string;
  hint: string;
}

const ELECTRIC = /electric|\bhvac\b|heating|furnace/i;
const PLUMBING = /plumb|sprinkler/i;
const GAS = /\bgas\b/i;

/** What to switch off before this trade starts, or null for volunteers, empty trades and finish work. */
export function shutOffFirst(trade: string | undefined): ShutOffNote | null {
  const t = (trade ?? "").trim();
  if (!t || /^volunteer/i.test(t)) return null;
  if (GAS.test(t)) return { label: "Gas off first", hint: "Confirm the gas is shut off at its valve before this work starts." };
  if (ELECTRIC.test(t)) return { label: "Power off first", hint: "Confirm the power is switched off at the breaker before this work starts." };
  if (PLUMBING.test(t)) return { label: "Water off first", hint: "Confirm the water is shut off at its valve before this work starts." };
  return null;
}
