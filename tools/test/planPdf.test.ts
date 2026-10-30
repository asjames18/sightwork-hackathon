/** Save PDF: the plan as a real PDF file (jsPDF, run here in Node), and how the file is handed over. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { buildPlanPdf, pdfFileName, pdfFrameIndexes, pdfSafe, PDF_SAMPLE_LABEL, type PdfImage } from "@/lib/client/planPdf";
import { deliverPlanPdf, loadPdfImages, type PlanPdf } from "@/lib/client/savePlanPdf";
import { EXAMPLES } from "@/lib/examples";
import { COST_LABEL, type WorkPlan } from "@/lib/types";

const JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAJABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCWiiitzA//2Q==";
const IMG: PdfImage = { dataUrl: JPEG, width: 16, height: 9 };
const DAY = new Date(2026, 9, 30, 17, 0);

/** Every string drawn with Tj, joined, from an uncompressed PDF. */
function pdfText(doc: { output: (t: "arraybuffer") => ArrayBuffer }): string {
  const raw = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) parts.push(m[1].replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ");
}
/** Pictures drawn on the pages (jsPDF stores one copy of identical pictures, so count the draws). */
const imageCount = (doc: { output: (t: "arraybuffer") => ArrayBuffer }) =>
  (Buffer.from(doc.output("arraybuffer")).toString("latin1").match(/\/I\d+ Do/g) ?? []).length;

function plan(extra: Partial<WorkPlan> = {}): WorkPlan {
  return {
    spaceName: "Fellowship hall",
    generatedFrom: "Walkthrough video, 3 frames, 40 s, narrated",
    inventory: [{ label: "folding chairs", count: 48, confidence: 0.9, range: [46, 50] }],
    issues: [
      { rank: 1, title: "Extension cord across the doorway", detail: "Trip hazard at the main exit.", severity: "high", frameIndex: 0, frameTimeSec: 2, unmentioned: true, proofFrames: [{ frameIndex: 0, tSec: 2, box: [100, 500, 600, 700], caption: "cord at exit" }] },
      { rank: 2, title: "Ceiling tile stain", detail: "Brown ring above the stage.", severity: "medium", frameIndex: 1, frameTimeSec: 20, unmentioned: false },
      { rank: 3, title: "Squeaky door hinge", detail: "", severity: "low", frameIndex: 2, frameTimeSec: 30, unmentioned: false, status: "mentioned_not_seen" },
    ],
    materials: [{ item: "Cord cover", qty: "1", unitCost: [18, 30] }, { item: "Ceiling tile 2x2", qty: "2" }],
    workOrder: [
      { order: 1, title: "Move the cord and cover it", detail: "Run it along the wall.", trade: "Volunteer", hours: [0.5, 1] },
      { order: 2, title: "Replace the stained tile", detail: "Find the leak first.", dependsOn: 1, fixes: [2] },
    ],
    afterImageUrl: null,
    transcript: "[0.0] Check the hall.",
    transcriptSummary: "Ready the hall for Sunday.",
    frames: [
      { index: 0, tSec: 2, url: "/f0.webp" },
      { index: 1, tSec: 20, url: "/f1.webp" },
      { index: 2, tSec: 30, url: "/f2.webp" },
    ],
    costRange: { low: 120, high: 340, currency: "USD", label: COST_LABEL, region: "Sebring, FL", laborBasis: "volunteer", assumptions: ["Mid-grade materials"], sources: [{ title: "Home Depot cord cover", url: "https://example.com/cord" }] },
    ...extra,
  };
}

test("file name uses the local date", () => {
  assert.equal(pdfFileName(DAY), "sightwork-plan-2026-10-30.pdf");
  assert.equal(pdfFileName(new Date(2027, 0, 5)), "sightwork-plan-2027-01-05.pdf");
});

test("text is made safe for the built-in fonts", () => {
  assert.equal(pdfSafe("Cost \u2013 \u201Cquote\u201D \u2019s\u2026 \u2022 caf\u00E9 \u{1F6A7}ok"), "Cost - \"quote\" 's... \u00B7 caf\u00E9 ok");
});

test("frames needed: proof photos (not said-but-unseen ones), plus the hero only with an after picture", () => {
  assert.deepEqual(pdfFrameIndexes(plan()), [0, 1]);
  assert.deepEqual(pdfFrameIndexes(plan({ afterImageUrl: "/after.webp", heroFrameIndex: 2 })), [0, 1, 2]);
});

test("PDF carries title, location, date, counts, ranked problems, steps, materials and the labelled cost", () => {
  const doc = buildPlanPdf(jsPDF, plan(), { date: DAY, compress: false, images: { frames: new Map([[0, IMG], [1, IMG]]) } });
  const text = pdfText(doc);
  for (const want of [
    "Fellowship hall",
    "Sebring, FL",
    "Oct 30, 2026",
    "Problems found",
    "What you asked for: Ready the hall for Sunday.",
    "Problems, worst first (3 problems)",
    "#1",
    "Extension cord across the doorway",
    "Spotted on video, not mentioned on the walk.",
    "Mentioned on the walk, not seen on video.",
    "What's there (approximate)",
    "46-50",
    "folding chairs",
    "Do the work in this order",
    "Move the cord and cover it",
    "after step 1",
    "Materials",
    "Cord cover",
    "$18-$30 each",
    "Cost range for Sebring, FL",
    "$120 - $340",
    COST_LABEL,
    "Page 1 of",
  ]) {
    assert.ok(text.includes(want), `missing "${want}"`);
  }
  assert.ok(text.indexOf("Extension cord") < text.indexOf("Ceiling tile stain"), "worst first");
  assert.ok(text.indexOf("Ceiling tile stain") < text.indexOf("Squeaky door hinge"));
  assert.equal(imageCount(doc), 2, "two proof thumbnails");
  assert.doesNotMatch(text, new RegExp(PDF_SAMPLE_LABEL));
  assert.match(Buffer.from(doc.output("arraybuffer")).toString("latin1"), /\/URI \(https:\/\/example\.com\/cord\)/);
});

test("a long plan breaks across pages and numbers every page", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ order: i + 1, title: `Step ${i + 1}: do a careful thing`, detail: "A sentence of detail about it. ".repeat(3) }));
  const doc = buildPlanPdf(jsPDF, plan({ workOrder: many }), { date: DAY, compress: false });
  const pages = doc.getNumberOfPages();
  assert.ok(pages >= 3, `pages ${pages}`);
  const text = pdfText(doc);
  for (let p = 1; p <= pages; p++) assert.ok(text.includes(`Page ${p} of ${pages}`));
  assert.ok(text.includes("Step 40: do a careful thing"));
});

test("sample example: labelled on page one and in every footer; no cost range says so", () => {
  const ex = EXAMPLES.find((e) => e.kind === "sample")!;
  const doc = buildPlanPdf(jsPDF, ex.plan, { date: DAY, compress: false, example: { kind: "sample", banner: ex.banner } });
  const text = pdfText(doc);
  assert.ok(text.includes("SAMPLE"));
  assert.ok(text.includes(ex.plan.spaceName));
  const pages = doc.getNumberOfPages();
  assert.equal(text.split(PDF_SAMPLE_LABEL).length - 1, pages, "sample label in every footer");
  if (!ex.plan.costRange && ex.plan.materials.length) assert.ok(text.includes("This sample has no cost range"));
});

test("real-run example: before and after picture with its AI-concept label, and the Real run banner", () => {
  const ex = EXAMPLES.find((e) => e.kind === "real")!;
  const p = ex.plan;
  assert.ok(p.afterImageUrl && p.heroFrameIndex !== undefined);
  const frames = new Map(pdfFrameIndexes(p).map((i) => [i, IMG] as const));
  const doc = buildPlanPdf(jsPDF, p, { date: DAY, compress: false, example: { kind: "real", banner: ex.banner }, images: { frames, after: IMG } });
  const text = pdfText(doc);
  assert.ok(text.includes("REAL RUN"));
  assert.ok(text.includes("Before and after"));
  assert.ok(text.includes("AI concept, not a render"));
  assert.doesNotMatch(text, new RegExp(PDF_SAMPLE_LABEL));
  assert.ok(imageCount(doc) >= 2);
});

test("after picture alone (no hero frame) and a plan with no problems", () => {
  const doc = buildPlanPdf(jsPDF, plan({ issues: [], afterImageUrl: "/a.webp" }), { date: DAY, compress: false, images: { frames: new Map(), after: IMG } });
  const text = pdfText(doc);
  assert.ok(text.includes("After the work"));
  assert.ok(text.includes("Nothing stood out"));
});

test("loadPdfImages decodes what it can and skips what it can't", async () => {
  const seen: string[] = [];
  const images = await loadPdfImages(plan({ afterImageUrl: "/after.webp", heroFrameIndex: 2 }), async (url) => {
    seen.push(url);
    return url === "/f1.webp" ? null : IMG;
  });
  assert.deepEqual(seen.sort(), ["/after.webp", "/f0.webp", "/f1.webp", "/f2.webp"]);
  assert.deepEqual([...images.frames.keys()].sort(), [0, 2]);
  assert.equal(images.after, IMG);
});

const pdf: PlanPdf = { file: new File([new Uint8Array([37, 80, 68, 70])], "sightwork-plan-2026-10-30.pdf", { type: "application/pdf" }), name: "sightwork-plan-2026-10-30.pdf", bytes: 4 };
const named = (name: string) => Object.assign(new Error(name), { name });

test("deliver: a phone whose share sheet takes files shares the PDF", async () => {
  const shared: unknown[] = [];
  const downloads: string[] = [];
  const r = await deliverPlanPdf(pdf, {
    nav: { canShare: (d) => Boolean(d.files?.length), share: async (d) => { shared.push(d); } },
    preferShare: true,
    download: (_b, n) => (downloads.push(n), true),
  });
  assert.equal(r, "shared");
  assert.equal(shared.length, 1);
  assert.deepEqual(downloads, []);
});

test("deliver: dismissed sheet is cancelled; a stale tap asks for one more, then downloads if refused again", async () => {
  const downloads: string[] = [];
  const download = (_b: Blob, n: string) => (downloads.push(n), true);
  const canShare = () => true;
  assert.equal(await deliverPlanPdf(pdf, { nav: { canShare, share: async () => { throw named("AbortError"); } }, preferShare: true, download }), "cancelled");
  assert.equal(await deliverPlanPdf(pdf, { nav: { canShare, share: async () => { throw named("NotAllowedError"); } }, preferShare: true, download }), "needs-tap");
  assert.deepEqual(downloads, []);
  assert.equal(await deliverPlanPdf(pdf, { nav: { canShare, share: async () => { throw named("NotAllowedError"); } }, preferShare: true, download, retry: true }), "downloaded");
  assert.equal(await deliverPlanPdf(pdf, { nav: { canShare, share: async () => { throw named("DataError"); } }, preferShare: true, download }), "downloaded");
  assert.deepEqual(downloads, [pdf.name, pdf.name]);
});

test("deliver: computers and sheets without file support download; no way to download fails", async () => {
  let shareCalls = 0;
  const share = async () => { shareCalls++; };
  const ok = (_b: Blob, _n: string) => true;
  assert.equal(await deliverPlanPdf(pdf, { nav: { canShare: () => true, share }, preferShare: false, download: ok }), "downloaded");
  assert.equal(await deliverPlanPdf(pdf, { nav: { canShare: () => false, share }, preferShare: true, download: ok }), "downloaded");
  assert.equal(await deliverPlanPdf(pdf, { nav: { share }, preferShare: true, download: ok }), "downloaded");
  assert.equal(shareCalls, 0);
  assert.equal(await deliverPlanPdf(pdf, { nav: {}, preferShare: true, download: () => false }), "failed");
  assert.equal(await deliverPlanPdf(pdf, { nav: {}, preferShare: false, download: () => { throw new Error("blocked"); } }), "failed");
});
