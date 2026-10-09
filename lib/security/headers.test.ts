import { describe, expect, it } from "vitest";
import { clerkFrontendApi, contentSecurityPolicy, securityHeaders } from "./headers";

const key = (host: string, mode = "live") => `pk_${mode}_${Buffer.from(`${host}$`).toString("base64")}`;

describe("clerkFrontendApi", () => {
  it("decodes the Frontend API host from a publishable key", () => {
    expect(clerkFrontendApi(key("clerk.syllabyss.tech"))).toBe("https://clerk.syllabyss.tech");
    expect(clerkFrontendApi(key("eager-fish-12.clerk.accounts.dev", "test"))).toBe(
      "https://eager-fish-12.clerk.accounts.dev",
    );
  });

  it("returns null for a missing or malformed key", () => {
    expect(clerkFrontendApi(undefined)).toBeNull();
    expect(clerkFrontendApi("")).toBeNull();
    expect(clerkFrontendApi("sk_live_abc")).toBeNull();
    expect(clerkFrontendApi(`pk_live_${Buffer.from("not a host; script-src *$").toString("base64")}`)).toBeNull();
  });
});

describe("contentSecurityPolicy", () => {
  it("allows the Clerk host for scripts and connections, and nothing frames the site", () => {
    const csp = contentSecurityPolicy({ clerkOrigin: "https://clerk.syllabyss.tech", dev: false });
    const directive = (name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `));
    expect(directive("script-src")).toContain("https://clerk.syllabyss.tech");
    expect(directive("connect-src")).toContain("https://clerk.syllabyss.tech");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows eval and websockets only in dev", () => {
    const csp = contentSecurityPolicy({ clerkOrigin: null, dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
  });
});

describe("securityHeaders", () => {
  it("sends the CSP as Report-Only unless enforced", () => {
    const names = (enforce: boolean) => securityHeaders({ clerkOrigin: null, dev: false, enforce }).map((h) => h.key);
    expect(names(false)).toContain("Content-Security-Policy-Report-Only");
    expect(names(false)).not.toContain("Content-Security-Policy");
    expect(names(true)).toContain("Content-Security-Policy");
    expect(names(true)).toContain("Strict-Transport-Security");
  });
});
