import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Vinext also applies this limit while forwarding route-handler requests.
      // Leave room for multipart metadata around the app's 5 MB image limit.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
