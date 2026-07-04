import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal `.next/standalone` server bundle (only the traced
  // production dependencies) — used by the Docker image, see Dockerfile.
  output: "standalone",
};

export default nextConfig;
