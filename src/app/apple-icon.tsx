import { ImageResponse } from "next/og";

// Home-screen icon for phones (iOS reads apple-touch-icon; the manifest lists it too).
// Same mark as icon.svg, drawn full-bleed because the phone rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#14171c" }}>
        <svg width="150" height="150" viewBox="0 0 32 32">
          <path d="M5 16c3-5.5 6.8-8 11-8s8 2.5 11 8c-3 5.5-6.8 8-11 8s-8-2.5-11-8z" fill="none" stroke="#f7f5f0" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="4.2" fill="#e8590c" />
        </svg>
      </div>
    ),
    size,
  );
}
