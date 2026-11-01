/**
 * Empty-state lines for a plan that came back without work steps. A plan with no problems has nothing to fix,
 * but a plan with problems and no steps means the fixes were not laid out this run, and its cost step has
 * nothing to price (the cost prompt needs at least one step), so retrying for a price would not help.
 */

/** The line under "Do the work in this order" when the work order is empty. */
export function noStepsLine(problemCount: number): string {
  if (problemCount <= 0) return "No work steps, since nothing needs fixing.";
  const what = problemCount === 1 ? "the problem above" : `the ${problemCount} problems above`;
  return `This run didn\u2019t lay out work steps for ${what}. Plan the fixes from the problem list, or run the walkthrough again for a step-by-step order.`;
}

/**
 * The line in the cost card when there is no cost range because there were no work steps to price, or null when
 * the plan has steps (the usual missing-region or failed-cost lines apply then).
 */
export function noStepsCostLine(stepCount: number, materialCount: number): string | null {
  if (stepCount > 0 || materialCount <= 0) return null;
  return "No cost range, since there are no work steps to price. The materials list still shows what to buy.";
}
