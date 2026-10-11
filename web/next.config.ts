import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/search": ["./data/earth-candidates.csv"],
  },
};

export default nextConfig;

