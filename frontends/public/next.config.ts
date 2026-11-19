import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Wires up src/i18n/request.ts (loads the right messages/<locale>.json per request).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Tailwind CSS is compiled through PostCSS (see postcss.config.mjs).
  devIndicators: false,
  // The Docker image (Dockerfile) runs a self-contained server; Vercel and `npm run build` build as usual.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default withNextIntl(nextConfig);
