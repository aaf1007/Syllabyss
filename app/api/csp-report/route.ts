import { violations } from "@/lib/security/csp-report";

// CSP violation reports (#5): browsers POST here from the `report-uri` / `report-to` directives
// (lib/security/headers.ts). Public by design, since browsers send no credentials. Each report becomes
// one `[csp]` log line in Render, which is how we decide when to enforce the policy.

const MAX_BODY = 16 * 1024;

export async function POST(req: Request) {
  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  for (const v of violations(body)) console.warn("[csp]", JSON.stringify(v));
  return new Response(null, { status: 204 });
}
