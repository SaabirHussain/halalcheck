import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.HALALCHECK_DIST_DIR ?? ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
