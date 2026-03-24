import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    resolveAlias: {
      canvas: { browser: "" },
    },
  },
};

export default nextConfig;
