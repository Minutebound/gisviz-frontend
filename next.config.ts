import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        // Intercept any request starting with /api/
        source: '/api/:path*',
        // Forward it silently to the FastAPI backend
        destination: 'http://gisviz-api:8001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
