import type { NextConfig } from "next";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXTAUTH_BACKEND_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendUrl) {
      return [];
    }

    const destination = backendUrl.replace(/\/$/, "");

    return [
      {
        source: "/api/:path*",
        destination: `${destination}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
