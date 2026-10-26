/**
 * EXAMPLE frames for the mock plan. These are simple drawn placeholders
 * (inline SVG data URLs), not real footage. Real frames come from
 * tools/frames or the browser.
 */
import type { PlanFrame } from "../types";

export type MockScene = {
  tSec: number;
  view: "seats" | "stage" | "wall" | "ceiling" | "side";
  note: string;
};

export const MOCK_SCENES: MockScene[] = [
  { tSec: 0, view: "seats", note: "Entering from the back" },
  { tSec: 6, view: "seats", note: "Front rows" },
  { tSec: 12, view: "stage", note: "Stage, wide" },
  { tSec: 16, view: "wall", note: "Back wall" },
  { tSec: 26, view: "ceiling", note: "Stage lights" },
  { tSec: 32, view: "stage", note: "Stage steps" },
  { tSec: 36, view: "stage", note: "Center aisle at steps" },
  { tSec: 42, view: "side", note: "Behind the drums" },
  { tSec: 50, view: "stage", note: "Step carpet" },
  { tSec: 58, view: "side", note: "Stage left door" },
  { tSec: 66, view: "ceiling", note: "Ceiling, stage right" },
  { tSec: 74, view: "seats", note: "Leaving, wide" },
];

function scene(view: MockScene["view"], seed: number, after = false): string {
  const wall = after ? "#efe6d6" : "#c9bfae";
  const parts: string[] = [];
  parts.push(`<rect width="640" height="360" fill="#2b2f36"/>`);
  parts.push(`<rect x="0" y="0" width="640" height="${view === "ceiling" ? 220 : 170}" fill="${view === "ceiling" ? "#d9d4c9" : wall}"/>`);
  if (view === "ceiling") {
    for (let i = 0; i < 7; i++)
      parts.push(`<circle cx="${60 + i * 85}" cy="70" r="16" fill="${!after && i === 3 ? "#555" : "#ffe9a8"}"/>`);
    if (!after && seed === 10) parts.push(`<ellipse cx="520" cy="150" rx="70" ry="38" fill="#a8946b" opacity=".75"/>`);
  } else {
    parts.push(`<rect x="0" y="170" width="640" height="60" fill="#5a4636"/>`);
    if (view !== "wall") {
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 12; c++)
          parts.push(`<rect x="${20 + c * 52}" y="${250 + r * 28}" width="34" height="18" rx="3" fill="#3f5a7a"/>`);
    }
    if (view === "stage" || view === "side") {
      parts.push(`<rect x="250" y="110" width="140" height="60" rx="6" fill="#222"/>`);
      parts.push(`<rect x="60" y="120" width="40" height="50" fill="#111"/><rect x="540" y="120" width="40" height="50" fill="#111"/>`);
    }
    if (!after && view === "stage" && seed === 6)
      parts.push(`<path d="M300 230 C 340 260, 280 300, 330 360" stroke="#111" stroke-width="7" fill="none"/>`);
    if (!after && view === "side" && seed === 7)
      parts.push(`<path d="M420 165 q20 -40 40 0 t40 0 t40 0" stroke="#111" stroke-width="5" fill="none"/><rect x="430" y="160" width="90" height="12" fill="#ddd"/>`);
    if (view === "side" && seed === 9)
      parts.push(`<rect x="40" y="40" width="80" height="30" fill="${after ? "#2f9e44" : "#3b3b3b"}"/><text x="80" y="62" font-size="18" text-anchor="middle" fill="${after ? "#fff" : "#777"}" font-family="sans-serif">EXIT</text>`);
    if (!after && view === "wall") parts.push(`<rect x="120" y="40" width="160" height="70" fill="#b3a893"/><rect x="380" y="60" width="120" height="50" fill="#b8ad97"/>`);
  }
  return parts.join("");
}

function svgUrl(body: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">${body}<rect x="8" y="8" width="128" height="26" rx="4" fill="#000" opacity=".55"/><text x="72" y="26" font-size="14" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const MOCK_FRAMES: PlanFrame[] = MOCK_SCENES.map((s, i) => ({
  index: i,
  tSec: s.tSec,
  url: svgUrl(scene(s.view, i), `EXAMPLE ${s.tSec}s`),
  reason: i % 3 === 2 ? "scene" : "interval",
}));

export const MOCK_AFTER_IMAGE_URL = svgUrl(scene("stage", 2, true), "EXAMPLE after");
