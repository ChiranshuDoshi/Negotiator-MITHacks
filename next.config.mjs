/** @type {import("next").NextConfig} */
const nextConfig = {
  // Keep Zod native in Node route handlers to avoid Turbopack cross-chunk initialization failures.
  serverExternalPackages: ["zod"],
};

export default nextConfig;
