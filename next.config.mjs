// No basePath. The app is served at the domain root (fabsheet.org/dashboard).
// Access control is BetterAuth (magic link + allowlist), not URL obscurity.

// R2 hosts. We allow both the account host (path-style, what we sign now) and
// the wildcard virtual-hosted form as a safety net so signed GETs keep working
// if the SDK ever changes its default URL style.
const r2Host = process.env.R2_ACCOUNT_ID
  ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : "";
const r2Wildcard = "https://*.r2.cloudflarestorage.com https://*.r2.dev";
const r2Public = process.env.R2_PUBLIC_URL || "";

// Content Security Policy. Next needs 'unsafe-inline' for its injected styles
// and (in dev) 'unsafe-eval'; everything else is locked to self + the specific
// upstreams we actually call.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${r2Host} ${r2Wildcard} ${r2Public}`.trim().replace(/\s+/g, " "),
  `font-src 'self' data:`,
  `connect-src 'self' https://api.anthropic.com https://api.resend.com ${r2Host} ${r2Wildcard} ${r2Public}`.trim().replace(/\s+/g, " "),
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  serverExternalPackages: ["@anthropic-ai/sdk", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/report/pdf": ["./node_modules/.pnpm/**/pdfkit/js/data/*.afm"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
