import type { WorkStep } from "@/lib/types";

/**
 * The steps that wait on a given step (their dependsOn points at it), so whoever does that step knows who to
 * tell when they finish, and a leader can see which steps hold up the rest of the work order.
 */
type WaitStep = Pick<WorkStep, "order" | "dependsOn" | "title">;

/** Steps whose wait-for step is `order`, lowest first. A step never waits on itself. */
export function stepsWaitingOn<T extends WaitStep>(workOrder: readonly T[], order: number): T[] {
  const seen = new Set<number>();
  return workOrder
    .filter((s) => s.dependsOn === order && s.order !== order && Number.isInteger(s.order))
    .filter((s) => (seen.has(s.order) ? false : (seen.add(s.order), true)))
    .sort((a, b) => a.order - b.order);
}

const list = (nums: readonly number[]) =>
  nums.length <= 1 ? `${nums[0] ?? ""}` : `${nums.slice(0, -1).join(", ")} and ${nums[nums.length - 1]}`;

/** Chip on the step row: "Step 4 waits on this", "Steps 4 and 6 wait on this". Empty when nothing waits. */
export function waitersChipLabel(orders: readonly number[]): string {
  if (orders.length === 0) return "";
  return orders.length === 1 ? `Step ${orders[0]} waits on this` : `Steps ${list(orders)} wait on this`;
}

/** Full sentence for screen readers and the hover title. */
export function waitersDescription(orders: readonly number[]): string {
  if (orders.length === 0) return "";
  return orders.length === 1
    ? `Step ${orders[0]} can't start until this step is done.`
    : `Steps ${list(orders)} can't start until this step is done.`;
}

const oneLine = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");

/**
 * Line for Send this step: "When this is done, step 4 (Paint the rail) can start." or, for several,
 * "When this is done, these can start: step 4 (Paint the rail); step 6 (Rehang the banner)." Null when nothing waits.
 */
export function waitersShareLine(waiters: readonly WaitStep[]): string | null {
  if (waiters.length === 0) return null;
  const named = waiters.map((s) => {
    const t = oneLine(s.title);
    return `step ${s.order}${t ? ` (${t})` : ""}`;
  });
  return named.length === 1 ? `When this is done, ${named[0]} can start.` : `When this is done, these can start: ${named.join("; ")}.`;
}
