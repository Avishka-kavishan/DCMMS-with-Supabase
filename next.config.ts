import type { NextConfig } from "next";

const isStaticExport = process.env.BUILD_TARGET === "static";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
