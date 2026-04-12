import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the generate API route up to 120 seconds
  // (property fetch + market news + Claude + TTS can take 60-90s)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // audio responses can be several MB
    },
  },
};

export default nextConfig;
