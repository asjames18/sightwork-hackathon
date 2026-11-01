import type { Box, PlanFrame } from "@/lib/types";

/**
 * The proof photo for one problem as a JPEG file, with the problem outlined the way the plan screen draws it
 * (orange box; dashed when it is a rough highlight, not a SAM outline). "Send this problem" attaches it when the
 * phone's share sheet takes files, so the person who will fix it sees what to look for, not just a description.
 *
 * Built ahead of the tap (the share sheet needs the tap's user gesture, which an image load would use up), and
 * cached per frame and box. Anything that can't be drawn (no frame, an image that won't load, a cross-origin
 * image the canvas can't export) gives null, and the problem goes as text alone.
 */

export const PROOF_PHOTO_MAX_SIDE = 1280;
const ACCENT = "#e8590c";

/** File name for the photo: "sightwork-problem-2-loose-cables-across-the-stage.jpg". */
export function proofPhotoName(rank: number, title: string): string {
  const full = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // At most 40 characters, cut at a word break when there is one.
  const cut = full.length <= 40 ? full : full.slice(0, 41).lastIndexOf("-") > 0 ? full.slice(0, full.slice(0, 41).lastIndexOf("-")) : full.slice(0, 40);
  const slug = cut.replace(/-+$/g, "");
  return `sightwork-problem-${rank}${slug ? `-${slug}` : ""}.jpg`;
}

/** Output size: the image's own size, scaled down so the longer side is at most `max`. */
export function proofPhotoSize(width: number, height: number, max = PROOF_PHOTO_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** A normalized (0-1000) box in pixels, clamped to the picture, with the line width scaled to the picture. Null for an empty box. */
export function boxToPixels(box: Box, width: number, height: number): { x: number; y: number; w: number; h: number; line: number } | null {
  const clamp = (v: number) => Math.min(1000, Math.max(0, Number.isFinite(v) ? v : 0));
  const [x0, y0, x1, y1] = [clamp(box[0]), clamp(box[1]), clamp(box[2]), clamp(box[3])];
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const w = (Math.abs(x1 - x0) / 1000) * width;
  const h = (Math.abs(y1 - y0) / 1000) * height;
  if (w < 1 || h < 1) return null;
  const line = Math.max(3, Math.round(Math.min(width, height) / 160));
  return { x: (left / 1000) * width, y: (top / 1000) * height, w, h, line };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Same-origin and data: URLs never need this; for another origin it lets a CORS-enabled host's image be exported.
    if (/^https?:/i.test(url) && typeof location !== "undefined" && !url.startsWith(location.origin)) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image did not load"));
    img.src = url;
  });
}

/** Draws the frame and its outline and encodes a JPEG. Null when there is nothing to draw or the browser refuses. */
export async function buildProofPhoto(
  frame: PlanFrame | undefined,
  box: Box | undefined,
  opts: { rank: number; title: string; dashed: boolean },
): Promise<File | null> {
  if (!frame?.url || typeof document === "undefined") return null;
  try {
    const img = await loadImage(frame.url);
    const size = proofPhotoSize(img.naturalWidth, img.naturalHeight);
    if (!size.width) return null;
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size.width, size.height);
    const px = box ? boxToPixels(box, size.width, size.height) : null;
    if (px) {
      // A dark halo under the orange line, as on screen, so it reads on light and dark photos alike.
      ctx.lineJoin = "round";
      if (opts.dashed) ctx.setLineDash([px.line * 3, px.line * 2]);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = px.line + 4;
      ctx.strokeRect(px.x, px.y, px.w, px.h);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = px.line;
      ctx.strokeRect(px.x, px.y, px.w, px.h);
    }
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(resolve, "image/jpeg", 0.85);
      } catch {
        resolve(null); // a tainted canvas (cross-origin image without CORS) can't be exported
      }
    });
    if (!blob || blob.size === 0) return null;
    return new File([blob], proofPhotoName(opts.rank, opts.title), { type: "image/jpeg" });
  } catch {
    return null;
  }
}

const cache = new Map<string, Promise<File | null>>();

/** Same as buildProofPhoto, built once per frame, box and problem. */
export function getProofPhoto(
  frame: PlanFrame | undefined,
  box: Box | undefined,
  opts: { rank: number; title: string; dashed: boolean },
): Promise<File | null> {
  if (!frame?.url) return Promise.resolve(null);
  const key = `${frame.url.length > 200 ? `${frame.url.length}:${frame.url.slice(-120)}` : frame.url}|${box?.join(",") ?? ""}|${opts.rank}|${opts.title}|${opts.dashed ? 1 : 0}`;
  let p = cache.get(key);
  if (!p) {
    p = buildProofPhoto(frame, box, opts);
    cache.set(key, p);
    if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  }
  return p;
}

/**
 * The share text when the photo goes along: the text with a line pointing at the photo before the sign-off.
 * `problem` names which problem the photo shows (a step's photo is of one problem it fixes): "problem #2".
 */
export function withPhotoLine(text: string, outlined: boolean, problem?: string): string {
  const line = outlined
    ? `Photo attached, with ${problem ?? "the problem"} outlined.`
    : problem
      ? `Photo attached, showing ${problem}.`
      : "Photo attached.";
  const lines = text.split("\n");
  const blank = lines.lastIndexOf("");
  if (blank <= 0) return `${text}\n${line}`;
  lines.splice(blank, 0, line);
  return lines.join("\n");
}
