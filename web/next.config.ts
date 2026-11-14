import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image builds a self-contained server (PARALLAX_STANDALONE=1); Vercel ignores this.
  ...(process.env.PARALLAX_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  outputFileTracingIncludes: {
    // Everything the search route reads at run time (candidates, histograms, place labels, frozen targets).
    "/api/search": ["./data/*.csv", "./data/*.json"],
  },
};

export default nextConfig;
