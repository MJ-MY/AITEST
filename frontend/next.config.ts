import type { NextConfig } from "next";

const pythonApiOrigin = process.env.PY_API_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${pythonApiOrigin}/v1/:path*`,
      },
      {
        source: "/api/health",
        destination: `${pythonApiOrigin}/health`,
      },
    ];
  },
};

export default nextConfig;

