// Access-path prefix for single_tenant obscurity. Driven by ACCESS_PATH_PREFIX
// at build time so the prefix is not hardcoded in source. With basePath set,
// Next serves the app only under /<prefix>/... and returns 404 for bare paths,
// and automatically prefixes every <Link>, asset, and redirect.
const rawPrefix = (process.env.ACCESS_PATH_PREFIX || "").replace(/^\/+|\/+$/g, "");
const usesPrefix = (process.env.APP_MODE || "single_tenant") === "single_tenant" && rawPrefix.length > 0;
const basePath = usesPrefix ? `/${rawPrefix}` : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  ...(basePath ? { basePath } : {}),
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
