/** Save PDF and Send to your team carry the same step schedule as the Add to calendar file. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf } from "@/lib/client/planPdf";
import { planToText } from "@/lib/client/planText";
import { calendarSummary, stepWhen } from "@/lib/client/stepCalendar";
import type { WorkPlan, WorkStep } from "@/lib/types";

// Saturday, Oct 31, 2026: the next workday is Monday, Nov 2.
const DAY = new Date(2026, 9, 31, 18, 40);

function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}

const step = (order: number, hours?: [number, number]): WorkStep => ({ order, title: `Step title ${order}`, detail: "Do it.", trade: "Electrician", hours });

function plan(workOrder: WorkStep[]): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    generatedFrom: "Walkthrough video, 3 frames, 40 s",
    inventory: [],
    issues: [],
    materials: [],
    workOrder,
    afterImageUrl: null,
    transcript: null,
    frames: [],
  };
}

const steps = [step(1, [3, 5]), step(2, [6, 6]), step(3)];

test("PDF has the schedule line and a When line under each step, matching the calendar file", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan(steps), { date: DAY, compress: false }));
  const summary = calendarSummary(steps, DAY);
  assert.equal(summary, "Starts Mon, Nov 2, 9 AM; 2 workdays, 9 to 5.");
  assert.ok(text.includes(`Schedule: ${summary}`), "schedule line");
  const when = stepWhen(steps, DAY);
  assert.equal(when.get(1), "Mon, Nov 2, 9 AM to 1 PM");
  assert.equal(when.get(2), "Tue, Nov 3, 9 AM to 3 PM");
  assert.equal(when.get(3), "Tue, Nov 3, 3 PM to 5 PM");
  let last = text.indexOf("Do the work in this order");
  for (const s of steps) {
    const title = text.indexOf(`Step title ${s.order}`, last);
    const at = text.indexOf(`When: ${when.get(s.order)}`, title);
    assert.ok(title > last && at > title, `When line follows step ${s.order}`);
    last = at;
  }
});

test("PDF leaves the schedule out when there are no steps", () => {
  const text = pdfText(buildPlanPdf(jsPDF, plan([]), { date: DAY, compress: false }));
  assert.ok(!text.includes("Schedule:"));
  assert.ok(!text.includes("When:"));
});

test("Send to your team text has one schedule line right after the steps", () => {
  const text = planToText(plan(steps), { date: DAY });
  const lines = text.split("\n");
  const i = lines.indexOf("3. Step title 3 (Electrician)");
  assert.ok(i > 0, "last step line present");
  assert.equal(lines[i + 1], "Schedule: Starts Mon, Nov 2, 9 AM; 2 workdays, 9 to 5.");
  assert.ok(!planToText(plan([]), { date: DAY }).includes("Schedule:"));
});
