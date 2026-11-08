import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    // Everything the search route reads at run time (candidates, histograms, place labels, frozen targets).
    "/api/search": ["./data/*.csv", "./data/*.json"],
  },
};

export default nextConfig;

