import type { NextConfig } from "next";

// The app moved from / to /start when the landing page took /. Old deep links keep working:
// any of these query keys on / sends the visitor to /start with the query string kept as is.
const legacyAppQueryKeys = ["view", "mock", "runner", "fail"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `/start?view=example[&ex=<id>]` is served from the prerendered /start/example/<id> page (the URL in the
  // address bar doesn't change), so the example plan is in the first HTML: no upload-screen flash, no layout
  // shift, and the plan paints before any JavaScript runs. Unknown or missing ids get the featured example.
  // beforeFiles, because /start itself is a page and would win otherwise.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/start",
          has: [
            { type: "query" as const, key: "view", value: "example" },
            { type: "query" as const, key: "ex", value: "(?<ex>[a-z0-9-]+)" },
          ],
          destination: "/start/example/:ex",
        },
        {
          source: "/start",
          has: [{ type: "query" as const, key: "view", value: "example" }],
          destination: "/start/example/featured",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  // Baseline security headers on every response. The CSP here only covers framing, plugins, <base> and form
  // targets, so it cannot block the app's own scripts, styles, camera, blob video or data images.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
  async redirects() {
    return legacyAppQueryKeys.map((key) => ({
      source: "/",
      has: [{ type: "query" as const, key }],
      destination: "/start",
      permanent: false,
    }));
  },
};

export default nextConfig;
