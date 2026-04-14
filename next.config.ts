import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the generate API route up to 120 seconds
  // (property fetch + market news + Claude + TTS can take 60-90s)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // audio responses can be several MB
    },
  },
  // Keep heavy CJS native modules out of the webpack bundle so they load
  // correctly in Vercel serverless functions (Node.js runtime, not Edge).
  serverExternalPackages: ["pdf-parse", "mammoth", "canvas"],
};

export default nextConfig;
