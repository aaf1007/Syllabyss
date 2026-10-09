// Parses CSP violation reports for /api/csp-report (#5).

const MAX_REPORTS = 10;

export type Violation = { directive?: string; blocked?: string; page?: string; source?: string };

/** The fields we log, from either the legacy `application/csp-report` shape or Reporting API batches. */
export function violations(body: unknown): Violation[] {
  const pick = (r: Record<string, unknown>): Violation => ({
    directive: str(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"]),
    blocked: str(r["blocked-uri"] ?? r.blockedURL),
    page: str(r["document-uri"] ?? r.documentURL),
    source: str(r["source-file"] ?? r.sourceFile),
  });
  if (Array.isArray(body)) {
    return body
      .filter((r): r is { type: string; body: Record<string, unknown> } => r?.type === "csp-violation" && isObject(r.body))
      .slice(0, MAX_REPORTS)
      .map((r) => pick(r.body));
  }
  if (isObject(body) && isObject(body["csp-report"])) return [pick(body["csp-report"])];
  return [];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 300) : undefined);
