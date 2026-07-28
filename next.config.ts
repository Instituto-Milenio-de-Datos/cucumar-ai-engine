import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained production build (only the files/node_modules actually
  // needed at runtime) — what the Dockerfile's runtime stage copies.
  output: "standalone",
};

export default nextConfig;
