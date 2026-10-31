/**
 * The plan as a real PDF file, built in the browser from the plan data (no print dialog, no server).
 * Pure layout: the caller passes jsPDF (lazy-loaded on click, see savePlanPdf.ts) and the images, already
 * decoded to JPEG, so this runs the same in a unit test. Letter size, points.
 *
 * Contents, in the plan screen's order: title, city and state, date, video facts, the sample / real-run label,
 * the summary numbers, the after picture (with its "AI concept" label), problems worst first with their proof
 * photos and outlines, the reviewer line, counts, work steps in order, materials, and the cost range with its
 * "not a quote" label. Every page's footer repeats the sample label on example plans.
 */
import type { jsPDF as JsPdfDoc } from "jspdf";
import { AFTER_IMAGE_LABEL, COST_LABEL, type Box, type WorkPlan } from "@/lib/types";
import { planReview, verdictFor } from "@/lib/review";
import { coverageLine, issueNote, livePricesLine, planLocation, plainReviewLine, problemSummary, shareDate, WATCH_HEADING, WATCH_HINT, watchLine } from "./planText";
import { rankedIssues, watchItems } from "@/lib/planExtras";

export type JsPdfCtor = new (options?: { unit?: "pt"; format?: string; orientation?: "portrait"; compress?: boolean }) => JsPdfDoc;

/** A picture ready for the PDF: a JPEG data URL and its pixel size. */
export interface PdfImage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface PlanPdfImages {
  /** Keyed by index into plan.frames. Missing frames are left out (the problem still prints). */
  frames: Map<number, PdfImage>;
  after?: PdfImage | null;
}

export interface PlanPdfOptions {
  /** Hand-written sample plan: labelled on the first page and in every footer. */
  sample?: boolean;
  /** Example banner: "real" (a real run kept as an example) or "sample", with its banner text. */
  example?: { kind: "real" | "sample"; banner: string } | null;
  date?: Date;
  images?: PlanPdfImages;
  /** Zip the page streams (smaller file). Tests turn it off to read the text. */
  compress?: boolean;
}

export const PDF_SAMPLE_LABEL = "Example plan with sample data, not a real run";

/** "sightwork-plan-2026-10-30.pdf", by the local date. */
export function pdfFileName(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `sightwork-plan-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.pdf`;
}

/**
 * The built-in PDF fonts only cover Latin-1, so map the usual typographic characters to plain ones and drop
 * anything else (emoji, other scripts) rather than print garbage.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "\u00B7")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
}

/** Frame indexes the PDF shows: each problem's proof photo and the hero frame (for the before/after pair). */
export function pdfFrameIndexes(plan: WorkPlan): number[] {
  const frames = plan.frames ?? [];
  const out = new Set<number>();
  for (const i of plan.issues) {
    if (i.status === "mentioned_not_seen") continue;
    const idx = i.proofFrames?.[0]?.frameIndex ?? i.frameIndex;
    if (frames[idx]?.url) out.add(idx);
  }
  if (plan.afterImageUrl && plan.heroFrameIndex !== undefined && frames[plan.heroFrameIndex]?.url) out.add(plan.heroFrameIndex);
  return [...out];
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const span = (r: [number, number], unit = "") => (r[0] === r[1] ? `${r[0]}${unit}` : `${r[0]}-${r[1]}${unit}`);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

type Rgb = [number, number, number];
const INK: Rgb = [20, 23, 28];
const MUTED: Rgb = [92, 96, 102];
const LINE: Rgb = [224, 222, 216];
const ACCENT: Rgb = [232, 89, 12];
const ACCENT_DARK: Rgb = [194, 65, 12];
const SEVERITY: Record<string, Rgb> = { high: [220, 38, 38], medium: [245, 158, 11], low: [180, 182, 186] };
const AMBER_BG: Rgb = [254, 243, 199];
const AMBER_INK: Rgb = [120, 53, 15];
const GREEN_BG: Rgb = [236, 253, 245];
const GREEN_INK: Rgb = [6, 78, 59];

const PAGE_W = 612;
const PAGE_H = 792;
const M = 44;
const W = PAGE_W - 2 * M;
const FOOT = 36;

/** Builds the plan PDF. Returns the jsPDF document; call `.output("blob")` or `.output("arraybuffer")`. */
export function buildPlanPdf(JsPDF: JsPdfCtor, plan: WorkPlan, opts: PlanPdfOptions = {}): JsPdfDoc {
  const doc = new JsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: opts.compress ?? true });
  const date = opts.date ?? new Date();
  const sample = opts.sample ?? (opts.example ? opts.example.kind === "sample" : plan.meta?.isExample === true);
  const frames = plan.frames ?? [];
  const images: PlanPdfImages = opts.images ?? { frames: new Map() };
  const after = images.after ?? null;
  const narrated = Boolean(plan.transcript?.trim()) || (plan.transcriptTurns?.length ?? 0) > 0;
  const review = planReview(plan);
  // Ranked problems only, like the plan screen; lower-confidence finds get their own section.
  const issues = rankedIssues(plan).sort((a, b) => a.rank - b.rank);
  const watch = watchItems(plan);
  const steps = [...plan.workOrder].sort((a, b) => a.order - b.order);
  let y = M;

  doc.setProperties({ title: pdfSafe(`Work plan: ${clean(plan.spaceName)}`), subject: "SightWork work plan", creator: "SightWork" });

  const color = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (size: number, style: "normal" | "bold" = "normal", c: Rgb = INK) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    color(c);
  };
  const wrap = (text: string, width: number): string[] => doc.splitTextToSize(pdfSafe(text), width) as string[];
  const lineH = (size: number) => size * 1.32;
  const newPage = () => {
    doc.addPage();
    y = M;
  };
  const ensure = (h: number) => {
    if (y + h > PAGE_H - M - FOOT / 2) newPage();
  };
  /** Wrapped paragraph; breaks across pages line by line. */
  const para = (text: string, size: number, style: "normal" | "bold" = "normal", c: Rgb = INK, x = M, width = W, after = 4) => {
    font(size, style, c);
    for (const l of wrap(text, width)) {
      ensure(lineH(size));
      doc.text(l, x, y + size);
      y += lineH(size);
    }
    y += after;
  };
  /** Section title; `keep` is how much of what follows must fit on the same page, so a title never ends a page. */
  const heading = (text: string, keep = 36) => {
    ensure(38 + keep);
    y += 14;
    font(15, "bold");
    doc.text(pdfSafe(text), M, y + 15);
    y += 24;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.8);
    doc.line(M, y, M + W, y);
    y += 10;
  };
  const banner = (text: string, bg: Rgb, ink: Rgb, tag?: string) => {
    font(9.5);
    const lines = wrap(text, W - 20 - (tag ? 0 : 0));
    const h = lines.length * lineH(9.5) + (tag ? 16 : 0) + 14;
    ensure(h);
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(M, y, W, h, 6, 6, "F");
    let ty = y + 7;
    if (tag) {
      font(8, "bold", ink);
      doc.text(tag.toUpperCase(), M + 10, ty + 8);
      ty += 16;
    }
    font(9.5, "normal", ink);
    for (const l of lines) {
      doc.text(l, M + 10, ty + 9.5);
      ty += lineH(9.5);
    }
    y += h + 10;
  };
  /** Draws an image fitted into w x maxH at (x, top). Returns its drawn height. */
  const picture = (img: PdfImage, x: number, top: number, w: number, maxH: number, box?: Box): number => {
    const scale = Math.min(w / img.width, maxH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    try {
      doc.addImage(img.dataUrl, "JPEG", x, top, dw, dh, undefined, "FAST");
    } catch {
      return 0;
    }
    if (box) {
      const [x1, y1, x2, y2] = box.map((v) => Math.max(0, Math.min(1000, v)) / 1000);
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.setLineWidth(2);
      doc.rect(x + x1 * dw, top + y1 * dh, Math.max(2, (x2 - x1) * dw), Math.max(2, (y2 - y1) * dh), "S");
    }
    return dh;
  };

  // --- Header -------------------------------------------------------------
  font(11, "bold");
  doc.text("Sight", M, y + 11);
  font(11, "bold", ACCENT_DARK);
  doc.text("Work", M + doc.getTextWidth("Sight"), y + 11);
  font(9, "normal", MUTED);
  doc.text("Work plan", M + W, y + 11, { align: "right" });
  y += 26;
  para(clean(plan.spaceName) || "Walkthrough", 24, "bold", INK, M, W, 2);
  const location = planLocation(plan);
  const facts = [location, shareDate(date), clean(plan.generatedFrom ?? "")].filter(Boolean).join(" \u00B7 ");
  para(facts, 10, "normal", MUTED, M, W, 10);

  if (opts.example) {
    banner(opts.example.banner, opts.example.kind === "real" ? GREEN_BG : AMBER_BG, opts.example.kind === "real" ? GREEN_INK : AMBER_INK, opts.example.kind === "real" ? "Real run" : "Sample");
  } else if (sample) {
    banner("Sample data written by hand, not a real run.", AMBER_BG, AMBER_INK, "Sample");
  }

  // --- Summary numbers ---------------------------------------------------------
  const unmentioned = narrated ? issues.filter((i) => i.unmentioned).length : 0;
  const stats: [string, string][] = [
    [narrated ? "Problems found" : "Problems found on camera", String(issues.length)],
    ...(narrated ? ([["You didn't mention", String(unmentioned)]] as [string, string][]) : []),
    ...(steps.length ? ([["Work steps", String(steps.length)]] as [string, string][]) : []),
    ...(plan.costRange ? ([["Rough cost", `${usd(plan.costRange.low)}-${usd(plan.costRange.high)}`]] as [string, string][]) : []),
  ];
  ensure(64);
  doc.setFillColor(INK[0], INK[1], INK[2]);
  doc.roundedRect(M, y, W, 58, 8, 8, "F");
  const colW = W / stats.length;
  stats.forEach(([label, value], k) => {
    const x = M + 14 + k * colW;
    font(8.5, "bold", [210, 212, 215]);
    doc.text(pdfSafe(label), x, y + 18, { maxWidth: colW - 18 });
    font(value.length > 8 ? 14 : 20, "bold", [255, 255, 255]);
    doc.text(pdfSafe(value), x, y + 44);
  });
  y += 70;
  if (narrated && plan.transcriptSummary) para(`What you asked for: ${clean(plan.transcriptSummary)}`, 10.5, "normal", INK, M, W, 6);
  if (!narrated) para("No narration in this video, so everything here comes from what the camera saw.", 9.5, "normal", MUTED, M, W, 6);

  // --- After picture --------------------------------------------------------------
  if (after) {
    heading(plan.heroFrameIndex !== undefined && images.frames.get(plan.heroFrameIndex) ? "Before and after" : "After the work");
    const before = plan.heroFrameIndex !== undefined ? images.frames.get(plan.heroFrameIndex) : undefined;
    if (before) {
      const half = (W - 12) / 2;
      const h = Math.min(220, half * Math.max(before.height / before.width, after.height / after.width));
      ensure(h + 30);
      font(8.5, "bold", MUTED);
      doc.text("BEFORE", M, y + 9);
      doc.text("AFTER", M + half + 12, y + 9);
      y += 14;
      const h1 = picture(before, M, y, half, h);
      const h2 = picture(after, M + half + 12, y, half, h);
      y += Math.max(h1, h2) + 6;
    } else {
      const h = Math.min(300, W * (after.height / after.width));
      ensure(h + 20);
      y += picture(after, M, y, W, h) + 6;
    }
    para(plan.afterImageLabel ?? AFTER_IMAGE_LABEL, 9, "normal", MUTED, M, W, 4);
  }

  // --- Problems ---------------------------------------------------------------------
  heading(issues.length ? `Problems, worst first (${problemSummary(issues.length).replace(/, worst first$/, "")})` : "Problems", issues.length ? 170 : 36);
  if (!issues.length) para("Nothing stood out in the frames we looked at. Walk it in person before you sign off.", 10.5, "normal", MUTED);
  const thumbW = 170;
  for (const [n, issue] of issues.entries()) {
    const proof = issue.proofFrames?.[0];
    const idx = proof?.frameIndex ?? issue.frameIndex;
    const img = issue.status !== "mentioned_not_seen" ? images.frames.get(idx) : undefined;
    const textW = img ? W - thumbW - 30 : W - 16;
    const verdict = verdictFor(review, issue);
    font(12.5, "bold");
    const titleL = wrap(clean(issue.title), textW);
    font(9.5);
    const noteL = wrap(issueNote(issue, narrated, verdict), textW);
    const detailL = issue.detail ? wrap(clean(issue.detail), textW) : [];
    const reasonL = verdict?.verified === false && verdict.reason ? wrap(`Not backed by a photo: ${clean(verdict.reason)}`, textW) : [];
    const textH = 14 + titleL.length * lineH(12.5) + (noteL.length + detailL.length + reasonL.length) * lineH(9.5) + 10;
    const imgH = img ? Math.min(150, thumbW * (img.height / img.width)) + (proof?.caption ? 14 : 0) + 4 : 0;
    const h = Math.max(textH, imgH) + 16;
    ensure(h);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(M, y, W, h, 6, 6, "FD");
    const sev = SEVERITY[issue.severity] ?? SEVERITY.low;
    doc.setFillColor(sev[0], sev[1], sev[2]);
    doc.rect(M, y, 4, h, "F");
    let ty = y + 10;
    font(10, "bold", issue.severity === "low" ? MUTED : sev);
    doc.text(`#${n + 1}`, M + 14, ty + 10);
    ty += 14;
    font(12.5, "bold");
    for (const l of titleL) {
      doc.text(l, M + 14, ty + 12.5);
      ty += lineH(12.5);
    }
    font(9.5, "bold", narrated && issue.unmentioned ? ACCENT_DARK : MUTED);
    for (const l of noteL) {
      doc.text(l, M + 14, ty + 9.5);
      ty += lineH(9.5);
    }
    font(9.5, "normal", INK);
    for (const l of detailL) {
      doc.text(l, M + 14, ty + 9.5);
      ty += lineH(9.5);
    }
    font(9.5, "normal", AMBER_INK);
    for (const l of reasonL) {
      doc.text(l, M + 14, ty + 9.5);
      ty += lineH(9.5);
    }
    if (img) {
      const ix = M + W - thumbW - 10;
      const dh = picture(img, ix, y + 10, thumbW, 150, proof?.box);
      if (proof?.caption) {
        font(8, "normal", MUTED);
        const at = frames[idx]?.tSec ?? proof.tSec;
        doc.text(pdfSafe(`${clean(proof.caption)} (${Math.round(at)} s)`), ix, y + 10 + dh + 10, { maxWidth: thumbW });
      }
    }
    y += h + 8;
  }
  const reviewText = plainReviewLine(plan);
  if (reviewText) para(reviewText, 9.5, "normal", MUTED, M, W, 4);
  const why = coverageLine(plan);
  if (why) para(why, 9.5, "normal", MUTED, M, W, 4);

  // --- Worth a closer look -----------------------------------------------------------
  if (watch.length) {
    heading(`${WATCH_HEADING} (${watch.length})`, 50);
    para(WATCH_HINT, 9.5, "normal", MUTED, M, W, 6);
    for (const w of watch) {
      para(watchLine(w), 11, "bold", INK, M, W, 1);
      const sub = [w.detail ? clean(w.detail) : "", w.evidence ? `Photo shows: ${clean(w.evidence)}` : ""].filter(Boolean).join(" ");
      if (sub) para(sub, 9.5, "normal", MUTED, M, W, 6);
      else y += 5;
    }
  }

  // --- Counts -----------------------------------------------------------------------
  if (plan.inventory.length) {
    heading("What's there (approximate)");
    for (const item of plan.inventory) {
      const value = item.range ? span(item.range) : String(item.count);
      font(12, "bold");
      ensure(lineH(12));
      doc.text(pdfSafe(value), M, y + 12);
      const zone = item.zone && !item.label.toLowerCase().includes(item.zone.toLowerCase()) ? ` (${item.zone})` : "";
      font(10.5);
      doc.text(pdfSafe(`${clean(item.label)}${zone}`), M + 52, y + 12, { maxWidth: W - 52 });
      y += lineH(12) + 2;
    }
  }

  // --- Work steps ---------------------------------------------------------------------
  if (steps.length) {
    heading("Do the work in this order", 70);
    for (const s of steps) {
      const extra = [
        s.trade ? clean(s.trade) : null,
        s.hours ? `${span(s.hours)} h` : null,
        s.dependsOn ? `after step ${s.dependsOn}` : null,
        s.fixes?.length ? `fixes #${s.fixes.join(", #")}` : null,
      ]
        .filter(Boolean)
        .join(" \u00B7 ");
      font(11, "bold");
      const t = wrap(clean(s.title), W - 28);
      ensure(lineH(11) * t.length + 12);
      font(11, "bold", ACCENT_DARK);
      doc.text(`${s.order}.`, M, y + 11);
      font(11, "bold");
      for (const l of t) {
        doc.text(l, M + 24, y + 11);
        y += lineH(11);
      }
      if (s.detail) para(clean(s.detail), 9.5, "normal", INK, M + 24, W - 24, 0);
      if (extra) para(extra, 9, "normal", MUTED, M + 24, W - 24, 0);
      y += 8;
    }
  }

  // --- Materials ----------------------------------------------------------------------
  if (plan.materials.length) {
    heading("Materials", 40);
    for (const m of plan.materials) {
      const cost = m.unitCost ? `${usd(m.unitCost[0])}${m.unitCost[1] !== m.unitCost[0] ? `-${usd(m.unitCost[1])}` : ""} each` : "";
      font(10.5, "bold");
      const itemL = wrap(clean(m.item), W - 200);
      ensure(lineH(10.5) * itemL.length + 4);
      const top = y;
      for (const l of itemL) {
        doc.text(l, M, y + 10.5);
        y += lineH(10.5);
      }
      font(10.5);
      doc.text(pdfSafe(clean(m.qty)), M + W - 190, top + 10.5, { maxWidth: 100 });
      if (cost) {
        font(9.5, "normal", MUTED);
        doc.text(pdfSafe(cost), M + W, top + 10.5, { align: "right" });
      }
      if (m.note) para(clean(m.note), 9, "normal", MUTED, M, W - 200, 0);
      y += 4;
    }
    if (plan.materials.some((m) => m.unitCost)) para(`Prices are estimates. ${COST_LABEL}.`, 8.5, "normal", MUTED, M, W, 2);
  }

  // --- Cost -------------------------------------------------------------------------
  if (plan.costRange) {
    const c = plan.costRange;
    heading(`Cost range for ${clean(c.region)}`, 60);
    font(22, "bold");
    doc.text(pdfSafe(`${usd(c.low)} - ${usd(c.high)}`), M, y + 22);
    y += 30;
    para(c.label ?? COST_LABEL, 10.5, "bold", ACCENT_DARK, M, W, 2);
    const live = livePricesLine(c);
    if (live) para(live, 9.5, "normal", MUTED, M, W, 2);
    para(`Region: ${clean(c.region)} \u00B7 Labor: ${c.laborBasis}`, 9.5, "normal", MUTED, M, W, 2);
    for (const a of c.assumptions) para(`\u00B7 ${clean(a)}`, 9.5, "normal", MUTED, M + 6, W - 6, 0);
    if (c.sources?.length) {
      y += 4;
      para("Prices from:", 9.5, "bold", MUTED, M, W, 0);
      for (const s of c.sources) {
        font(9, "normal", ACCENT_DARK);
        ensure(lineH(9));
        const label = pdfSafe(clean(s.title)).slice(0, 110);
        doc.textWithLink(label, M + 6, y + 9, { url: s.url });
        y += lineH(9);
      }
    }
  } else if (plan.materials.length) {
    heading("What it might cost");
    para(
      plan.meta?.skipped?.cost
        ? "The cost range couldn't be worked out this run. The materials and work steps above are complete."
        : sample
          ? "This sample has no cost range. On a real run with a city and state, SightWork prices the materials and labor for that area."
          : "No city and state on this run, so there's no cost range.",
      10,
      "normal",
      MUTED,
    );
  }

  // --- Footer on every page ----------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    font(8, "normal", MUTED);
    const left = sample ? `SightWork \u00B7 ${PDF_SAMPLE_LABEL}` : "SightWork \u00B7 sightwork.vercel.app \u00B7 Check everything in person before work starts";
    doc.text(pdfSafe(left), M, PAGE_H - 24);
    doc.text(`Page ${p} of ${pages}`, M + W, PAGE_H - 24, { align: "right" });
  }
  return doc;
}
