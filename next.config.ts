import type { NextConfig } from "next";

// The app moved from / to /start when the landing page took /. Old deep links keep working:
// any of these query keys on / sends the visitor to /start with the query string kept as is.
const legacyAppQueryKeys = ["view", "mock", "runner", "fail"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
