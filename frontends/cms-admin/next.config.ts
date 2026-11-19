import type { NextConfig } from "next";

// The backend (FastAPI). The browser never calls it directly: /api/* and /media/* are forwarded
// from this app's own origin, so the session cookie stays first-party and no CORS is needed.
const apiUrl = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // The Docker image (Dockerfile) runs a self-contained server; Vercel and `npm run build` build as usual.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      { source: "/media/:path*", destination: `${apiUrl}/media/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // The admin panel is private: keep it out of search engines.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
