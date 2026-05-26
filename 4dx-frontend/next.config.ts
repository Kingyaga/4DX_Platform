import type { NextConfig } from "next";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXTAUTH_BACKEND_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendUrl) {
      return [];
    }

    const destination = backendUrl.replace(/\/$/, "");
    // Prevent accidental self-proxy loops (frontend dev server also runs on :3000).
    if (/^https?:\/\/(localhost|127\.0\.0\.1):3000$/i.test(destination)) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${destination}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
