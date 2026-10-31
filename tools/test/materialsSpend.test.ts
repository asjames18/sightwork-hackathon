import { test } from "node:test";
import assert from "node:assert/strict";
import { materialsSpend, qtyCount, shoppingListText, spendLine } from "../../src/lib/client/materialsList";
import type { MaterialItem } from "../../src/lib/types";

const plan = (materials: MaterialItem[]) => ({ spaceName: "Stage", materials });

test("qtyCount uses the leading number, else 1", () => {
  assert.equal(qtyCount("2 gallons"), 2);
  assert.equal(qtyCount("12 chairs"), 12);
  assert.equal(qtyCount("1.5 rolls"), 1.5);
  assert.equal(qtyCount("Measure on site"), 1);
  assert.equal(qtyCount("0"), 1);
});

test("materialsSpend sums qty x unit price over needed items and counts unpriced ones", () => {
  const p = plan([
    { item: "Paint", qty: "2 gallons", unitCost: [30, 45] },
    { item: "Tape", qty: "1 roll", unitCost: [5, 8] },
    { item: "Brackets", qty: "As needed" },
  ]);
  assert.deepEqual(materialsSpend(p), { low: 65, high: 98, priced: 2, unpriced: 1 });
  assert.deepEqual(materialsSpend(p, [0]), { low: 5, high: 8, priced: 1, unpriced: 1 });
});

test("materialsSpend is null when nothing needed is priced (example plans)", () => {
  assert.equal(materialsSpend(plan([{ item: "Bulbs", qty: "6" }])), null);
  assert.equal(materialsSpend(plan([{ item: "Paint", qty: "1", unitCost: [10, 20] }]), [0]), null);
  assert.equal(spendLine(null), "");
});

test("materialsSpend tolerates swapped or bad price pairs", () => {
  const s = materialsSpend(plan([
    { item: "A", qty: "2", unitCost: [20, 10] },
    { item: "B", qty: "1", unitCost: [Number.NaN, 5] },
  ]));
  assert.deepEqual(s, { low: 20, high: 40, priced: 1, unpriced: 1 });
});

test("spendLine wording", () => {
  assert.equal(
    spendLine({ low: 65, high: 98, priced: 2, unpriced: 1 }),
    "Materials to buy: about $65\u2013$98 for 2 items, materials only. 1 more has no price yet.",
  );
  assert.equal(
    spendLine({ low: 5, high: 5, priced: 1, unpriced: 0 }, { started: true }),
    "Still to buy: about $5 for 1 item, materials only.",
  );
  assert.equal(
    spendLine({ low: 1, high: 2, priced: 1, unpriced: 3 }, { dash: "-" }),
    "Materials to buy: about $1-$2 for 1 item, materials only. 3 more have no price yet.",
  );
});

test("shopping list text carries the spend line for what is still needed", () => {
  const p = plan([
    { item: "Paint", qty: "2 gallons", unitCost: [30, 45] },
    { item: "Tape", qty: "1 roll", unitCost: [5, 8] },
  ]);
  assert.match(shoppingListText(p), /Materials to buy: about \$65-\$98 for 2 items, materials only\./);
  assert.match(shoppingListText(p, [0]), /Still to buy: about \$5-\$8 for 1 item, materials only\./);
  assert.doesNotMatch(shoppingListText(plan([{ item: "Bulbs", qty: "6" }])), /to buy:/);
});
