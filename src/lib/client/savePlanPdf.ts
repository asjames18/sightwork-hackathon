/**
 * Save PDF, browser side: lazy-loads jsPDF, turns the plan's pictures into small JPEGs, builds the file
 * (planPdf.ts), and hands it over. Phones get the share sheet with the file (Save to Files, Messages, Mail);
 * everything else downloads it as sightwork-plan-<date>.pdf. The print dialog is only the last fallback,
 * for a browser that can't build the file at all.
 */
import type { WorkPlan } from "@/lib/types";
import { buildPlanPdf, pdfFileName, pdfFrameIndexes, type PdfImage, type PlanPdfImages, type PlanPdfOptions } from "./planPdf";
import { canShareFiles, type ShareNavigator } from "./planText";

export interface PlanPdf {
  file: File;
  name: string;
  bytes: number;
}

export type PdfLabel = Pick<PlanPdfOptions, "sample" | "example" | "since">;

/** Longest side of a picture in the PDF, in pixels: sharp at print size, small enough for a text attachment. */
const MAX_SIDE = 960;
const IMAGE_TIMEOUT_MS = 8000;

let jsPdfModule: Promise<typeof import("jspdf")> | null = null;
/** jsPDF is about 350 kB, so it loads on the first Save PDF (or when a phone warms the file), never with the page. */
export function loadJsPdf(): Promise<typeof import("jspdf")> {
  jsPdfModule ??= import("jspdf").catch((e) => {
    jsPdfModule = null;
    throw e;
  });
  return jsPdfModule;
}

/** Decodes any image the page can show (webp, data URL, same-site file) and re-encodes it as a JPEG for the PDF. Null when it can't. */
export function imageToJpeg(url: string, maxSide = MAX_SIDE): Promise<PdfImage | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (v: PdfImage | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), IMAGE_TIMEOUT_MS);
    try {
      if (/^https?:/i.test(url) && new URL(url, location.href).origin !== location.origin) img.crossOrigin = "anonymous";
    } catch {
      /* relative or data URL */
    }
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return finish(null);
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        finish({ dataUrl: canvas.toDataURL("image/jpeg", 0.8), width: canvas.width, height: canvas.height });
      } catch {
        finish(null); // a picture from another site without CORS taints the canvas: leave it out
      }
    };
    img.onerror = () => finish(null);
    img.src = url;
  });
}

/** The proof photos, the hero frame and the after picture, decoded in parallel. Missing ones are skipped. */
export async function loadPdfImages(plan: WorkPlan, toJpeg = imageToJpeg): Promise<PlanPdfImages> {
  const frames = plan.frames ?? [];
  const idx = pdfFrameIndexes(plan);
  const [decoded, after] = await Promise.all([
    Promise.all(idx.map((i) => toJpeg(frames[i].url))),
    plan.afterImageUrl ? toJpeg(plan.afterImageUrl) : Promise.resolve(null),
  ]);
  const map = new Map<number, PdfImage>();
  idx.forEach((i, k) => {
    const d = decoded[k];
    if (d) map.set(i, d);
  });
  return { frames: map, after };
}

/** Builds the PDF file for this plan. */
export async function makePlanPdf(plan: WorkPlan, label: PdfLabel = {}, date = new Date()): Promise<PlanPdf> {
  const [{ jsPDF }, images] = await Promise.all([loadJsPdf(), loadPdfImages(plan)]);
  const doc = buildPlanPdf(jsPDF, plan, { ...label, date, images });
  const blob = doc.output("blob");
  const name = pdfFileName(date);
  return { file: new File([blob], name, { type: "application/pdf" }), name, bytes: blob.size };
}

// One build per plan and label, shared by Save PDF and Send to your team. The settled value is kept too, so a
// tap can hand the file to the share sheet without awaiting anything (iOS only shares inside the tap itself).
const pending = new WeakMap<WorkPlan, Map<string, Promise<PlanPdf>>>();
const ready = new WeakMap<WorkPlan, Map<string, PlanPdf>>();
/** Cache key: the label plus the comparison, so a comparison that loads after a warm build gets its own file. */
export function pdfKeyOf(label: PdfLabel): string {
  const c = label.since?.comparison;
  const since = c ? [label.since?.when ?? "", ...[c.gone, c.stillThere, c.newOnes].map((g) => g.map((r) => `${r.tier}:${r.title}`).join("~"))].join("|") : "";
  return `${label.sample ? 1 : 0}|${label.example?.kind ?? ""}|${since}`;
}
const keyOf = pdfKeyOf;

export function getPlanPdf(plan: WorkPlan, label: PdfLabel = {}): Promise<PlanPdf> {
  const key = keyOf(label);
  let byKey = pending.get(plan);
  if (!byKey) pending.set(plan, (byKey = new Map()));
  let p = byKey.get(key);
  if (!p) {
    p = makePlanPdf(plan, label).then(
      (pdf) => {
        let r = ready.get(plan);
        if (!r) ready.set(plan, (r = new Map()));
        r.set(key, pdf);
        return pdf;
      },
      (e) => {
        byKey!.delete(key);
        throw e;
      },
    );
    byKey.set(key, p);
  }
  return p;
}

/** The PDF if it's already built, else null. Synchronous, for use inside a tap. */
export function peekPlanPdf(plan: WorkPlan, label: PdfLabel = {}): PlanPdf | null {
  return ready.get(plan)?.get(keyOf(label)) ?? null;
}

/** Phones (touch first) use the share sheet; mice and trackpads download. */
export function prefersShareSheet(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

/** Builds the PDF ahead of time on a phone whose share sheet takes files, so the tap can share at once. */
export function warmPlanPdf(plan: WorkPlan, label: PdfLabel = {}): () => void {
  if (typeof window === "undefined" || !prefersShareSheet()) return () => {};
  const probe = new File([new Uint8Array([37])], "probe.pdf", { type: "application/pdf" });
  if (!canShareFiles(navigator as ShareNavigator, [probe])) return () => {};
  const run = () => void getPlanPdf(plan, label).catch(() => {});
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = setTimeout(run, 800);
  return () => clearTimeout(t);
}

/** Downloads through a temporary link. False when the browser has no way to (no Blob URLs). */
export function downloadBlob(blob: Blob, name: string, doc: Document = document): boolean {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return false;
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export type DeliverResult = "shared" | "cancelled" | "downloaded" | "needs-tap" | "failed";

export interface DeliverEnv {
  nav: ShareNavigator;
  preferShare: boolean;
  download: (blob: Blob, name: string) => boolean;
  /** Second try after "needs-tap": a refused share now goes straight to the download. */
  retry?: boolean;
}

/**
 * Share sheet with the file when this is a phone and its sheet takes PDFs, else a download.
 * A share refused because the tap went stale (the file took a moment to build) is "needs-tap": the button
 * asks for one more tap, which shares at once. A dismissed sheet is "cancelled", never a download.
 */
export async function deliverPlanPdf(pdf: PlanPdf, env: DeliverEnv): Promise<DeliverResult> {
  if (env.preferShare && canShareFiles(env.nav, [pdf.file])) {
    try {
      await env.nav.share!({ files: [pdf.file], title: pdf.name });
      return "shared";
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") return "cancelled";
      if (name === "NotAllowedError" && !env.retry) return "needs-tap";
    }
  }
  try {
    return env.download(pdf.file, pdf.name) ? "downloaded" : "failed";
  } catch {
    return "failed";
  }
}
