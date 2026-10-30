/** `npm run eval`: score every answer key in tools/eval/keys against its plan JSON and print a table. Offline. */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { scorePlan, type AnswerKey } from "./score";

const root = path.resolve(import.meta.dirname, "../..");
const keysDir = path.join(root, "tools/eval/keys");
const planArg = process.argv[2];
let rows = 0;
for (const f of readdirSync(keysDir).filter((x) => x.endsWith(".json"))) {
  const key = JSON.parse(readFileSync(path.join(keysDir, f), "utf8")) as AnswerKey;
  const planPath = planArg ?? (key.plan ? path.join(root, key.plan) : null);
  if (!planPath) continue;
  const r = scorePlan(JSON.parse(readFileSync(planPath, "utf8")), key);
  rows++;
  console.log(
    `${r.id}: recall ${r.recall} (high ${r.highRecall}) · precision ${r.precision} · top problem is high-severity: ${r.topIsHigh ? "yes" : "no"}` +
      `\n  found: ${r.found.join(", ") || "none"}\n  missed: ${r.missed.join(", ") || "none"}\n  unmatched plan ranks: ${r.unmatched.join(", ") || "none"}`,
  );
}
if (rows === 0) console.log("No answer keys with a plan to score.");
