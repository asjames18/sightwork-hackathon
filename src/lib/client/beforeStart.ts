import type { WorkStep } from "@/lib/types";
import { shutOffFirst } from "./shutOffFirst";
import { OLD_MATERIAL_HINT, OLD_MATERIAL_LABEL, disturbsOldMaterial } from "./oldMaterialCheck";
import { HEIGHT_HINT, HEIGHT_LABEL, worksUpHigh } from "./workAtHeight";
import { FUMES_HINT, FUMES_LABEL, usesFumeProduct } from "./fumesCheck";
import { DUST_HINT, DUST_LABEL, makesDust } from "./dustCheck";
import { DRY_HINT, DRY_LABEL, needsDryTime } from "./dryTime";
import { WEATHER_HINT, WEATHER_LABEL, needsDryWeather } from "./dryWeather";
import { PERMIT_CHIP_HINT, PERMIT_CHIP_LABEL, tradeMayNeedPermit } from "./permitTrade";

/** One kind of heads-up and the steps that carry it, in plan order. */
export interface StartNote {
  key: string;
  label: string;
  hint: string;
  steps: number[];
}

type Stepish = Pick<WorkStep, "order"> & { title?: string; detail?: string; trade?: string };

/**
 * Gathers the small heads-up chips the plan screen draws on each step (permit, shut off, old paint or plaster,
 * up high, fumes, dust, drying, weather) into one list, so the whole plan's cautions can be read once before
 * anyone starts. It uses the very same checks as the chips, so the list and the steps never disagree, and it
 * adds nothing the step's own words did not already say. Empty when no step carries one.
 */
export function beforeStartNotes(steps: readonly Stepish[]): StartNote[] {
  const groups = new Map<string, StartNote>();
  const add = (key: string, label: string, hint: string, order: number) => {
    const g = groups.get(key) ?? { key, label, hint, steps: [] };
    if (!g.steps.includes(order)) g.steps.push(order);
    groups.set(key, g);
  };
  for (const step of steps) {
    const n = step.order;
    if (!Number.isFinite(n)) continue;
    const off = shutOffFirst(step.trade);
    if (off) add(`off:${off.label}`, off.label, off.hint, n);
    if (tradeMayNeedPermit(step.trade)) add("permit", PERMIT_CHIP_LABEL, PERMIT_CHIP_HINT, n);
    const old = disturbsOldMaterial(step);
    if (old) add("old", OLD_MATERIAL_LABEL, OLD_MATERIAL_HINT, n);
    if (worksUpHigh(step)) add("height", HEIGHT_LABEL, HEIGHT_HINT, n);
    if (usesFumeProduct(step)) add("fumes", FUMES_LABEL, FUMES_HINT, n);
    if (makesDust(step) && !old) add("dust", DUST_LABEL, DUST_HINT, n);
    if (needsDryTime(step)) add("dry", DRY_LABEL, DRY_HINT, n);
    if (needsDryWeather(step)) add("weather", WEATHER_LABEL, WEATHER_HINT, n);
  }
  // Power, gas and water first, then the rest in the order the chips show them.
  const rank = (key: string) => (key.startsWith("off:") ? 0 : ["permit", "old", "height", "fumes", "dust", "dry", "weather"].indexOf(key) + 1);
  return [...groups.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
}

/** "3 things to plan for" for the closed box, or "" when there is nothing. */
export function beforeStartSummary(notes: readonly StartNote[]): string {
  if (notes.length === 0) return "";
  return notes.length === 1 ? "1 thing to plan for" : `${notes.length} things to plan for`;
}
