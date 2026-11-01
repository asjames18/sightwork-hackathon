import type { WorkPlan, WorkStep } from "@/lib/types";

/**
 * Which materials a work step needs, and how many of them are already ticked as in hand on the shopping list.
 * A step needs a material when the material is for a problem the step fixes (the same rule as the step's
 * Bring list), so the work order, the shopping list and Send this step always agree.
 */
type StepMaterialsPlan = Pick<WorkPlan, "issues" | "materials">;

/** Indexes into plan.materials that this step needs, in list order. Only problems that exist on the plan count. */
export function stepMaterialIndexes(plan: StepMaterialsPlan, step: Pick<WorkStep, "fixes">): number[] {
  const ranks = new Set((plan.issues ?? []).map((i) => i.rank));
  const fixing = new Set((step.fixes ?? []).filter((r) => ranks.has(r)));
  if (fixing.size === 0) return [];
  const out: number[] = [];
  (plan.materials ?? []).forEach((m, i) => {
    if ((m.forIssues ?? []).some((r) => fixing.has(r))) out.push(i);
  });
  return out;
}

export interface StepMaterialsState {
  /** Materials the step needs. */
  total: number;
  /** Of those, how many are ticked as in hand. */
  have: number;
  /** Names of the ones still to buy, in list order. */
  missing: string[];
}

/** Null when the step needs no materials, so the chip stays away. */
export function stepMaterialsState(
  plan: StepMaterialsPlan,
  step: Pick<WorkStep, "fixes">,
  got: readonly number[] = [],
): StepMaterialsState | null {
  const need = stepMaterialIndexes(plan, step);
  if (need.length === 0) return null;
  const have = new Set(got);
  const missing = need.filter((i) => !have.has(i)).map((i) => plan.materials[i].item.replace(/\s+/g, " ").trim());
  return { total: need.length, have: need.length - missing.length, missing };
}

/**
 * Short chip text: "Needs 3 items", "1 of 3 items in hand", "Materials in hand" (one item: "Needs 1 item",
 * "Item in hand").
 */
export function stepMaterialsLabel(state: StepMaterialsState): string {
  const { total, have } = state;
  if (have >= total) return total === 1 ? "Item in hand" : "Materials in hand";
  if (have === 0) return `Needs ${total} item${total === 1 ? "" : "s"}`;
  return `${have} of ${total} items in hand`;
}

/** Fuller words for screen readers and the chip's title: which items are still to buy. */
export function stepMaterialsDescription(state: StepMaterialsState): string {
  if (state.missing.length === 0) return `Everything this step needs is in hand.`;
  return `Still to buy for this step: ${state.missing.join(", ")}.`;
}
