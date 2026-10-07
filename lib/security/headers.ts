// Security headers for every response (#5), applied in next.config.ts. Pure, so it's unit-tested
// and safe to import from the Next config (no `server-only`, no `@/` imports).
// Clerk's CSP requirements: https://clerk.com/docs/guides/secure/best-practices/csp-headers

/**
 * Report-Only until production has run a while with no violations in the logs (`[csp]` lines from
 * /api/csp-report). Then flip this to true. docs/security.md § CSP has the steps.
 */
export const CSP_ENFORCE = false;

export const CSP_REPORT_PATH = "/api/csp-report";

/**
 * Clerk's Frontend API origin, decoded from the publishable key (`pk_live_<base64("clerk.example.com$")>`).
 * Null when the key is missing or malformed; the CSP then only allows Clerk's shared hosts.
 */
export function clerkFrontendApi(publishableKey: string | undefined): string | null {
  const encoded = publishableKey?.match(/^pk_(?:test|live)_(.+)$/)?.[1];
  if (!encoded) return null;
  const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? `https://${host}` : null;
}

export function contentSecurityPolicy({ clerkOrigin, dev }: { clerkOrigin: string | null; dev: boolean }): string {
  const clerk = clerkOrigin ? [clerkOrigin] : [];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next's inline bootstrap scripts need 'unsafe-inline' without nonces; nonces would force every
    // page to render dynamically. Dev (React Refresh) also needs eval.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      ...clerk,
      "https://challenges.cloudflare.com",
      "https://*.protect.clerk.com",
    ],
    "connect-src": [
      "'self'",
      ...clerk,
      "https://*.protect.clerk.com:*",
      "https://clerk-telemetry.com",
      ...(dev ? ["ws:"] : []),
    ],
    "img-src": ["'self'", "blob:", "data:", "https://img.clerk.com"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "blob:", "data:"],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["https://challenges.cloudflare.com", "https://*.protect.clerk.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "report-uri": [CSP_REPORT_PATH],
    "report-to": ["csp"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders({
  clerkOrigin,
  dev,
  enforce = CSP_ENFORCE,
}: {
  clerkOrigin: string | null;
  dev: boolean;
  enforce?: boolean;
}): { key: string; value: string }[] {
  return [
    // Two years, every subdomain (clerk., accounts. are Clerk's and HTTPS-only). Browsers ignore it over http://localhost.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    { key: "Reporting-Endpoints", value: `csp="${CSP_REPORT_PATH}"` },
    {
      key: enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicy({ clerkOrigin, dev }),
    },
  ];
}
