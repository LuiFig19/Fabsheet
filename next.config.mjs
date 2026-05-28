// No basePath. The app is served at the domain root (fabsheet.org/dashboard).
// Access control is BetterAuth (magic link + allowlist), not URL obscurity, so
// the access-path prefix was removed to eliminate basePath/cookie/redirect
// conflicts with auth.
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  // Server-only packages kept external from the bundle.
  serverExternalPackages: ["@anthropic-ai/sdk", "pdfkit"],
  // pdfkit reads its built-in font metrics (.afm) from disk at runtime. Make
  // sure the standalone/Docker output traces those data files in.
  outputFileTracingIncludes: {
    "/api/report/pdf": ["./node_modules/.pnpm/**/pdfkit/js/data/*.afm"],
  },
};

export default nextConfig;
