import type { NextConfig } from "next";
import { clerkFrontendApi, securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Node-only parsers (F03): keep them out of the bundler.
  serverExternalPackages: ["unpdf", "mammoth"],
  experimental: {
    // proxy.ts buffers request bodies and silently truncates past this (default 10 MB).
    // Uploads go up to 25 MB, plus multipart overhead.
    proxyClientMaxBodySize: "26mb",
  },
  // Security headers and the CSP (#5): lib/security/headers.ts. Evaluated at build time, so the
  // Clerk host comes from the build's NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (a Docker build arg).
  async headers() {
    const headers = securityHeaders({
      clerkOrigin: clerkFrontendApi(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      dev: process.env.NODE_ENV === "development",
    });
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
