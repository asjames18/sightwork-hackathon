import type { MetadataRoute } from "next";

// Lets a phone add SightWork to its home screen with its own name and icon. It opens straight to the
// recorder (/start), without browser bars, in the same dark top bar the site uses.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SightWork",
    short_name: "SightWork",
    description: "Film a walkthrough. Get a work plan.",
    id: "/start",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f5f0",
    theme_color: "#14171c",
    categories: ["productivity", "business", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
