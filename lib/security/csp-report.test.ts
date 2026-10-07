import { describe, expect, it } from "vitest";
import { violations } from "./csp-report";

describe("violations", () => {
  it("reads the legacy report-uri shape", () => {
    const body = {
      "csp-report": {
        "document-uri": "https://syllabyss.tech/home",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/x.js",
      },
    };
    expect(violations(body)).toEqual([
      { directive: "script-src-elem", blocked: "https://evil.example/x.js", page: "https://syllabyss.tech/home", source: undefined },
    ]);
  });

  it("reads Reporting API batches and skips other report types", () => {
    const body = [
      { type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "https://x.example/a.png", documentURL: "https://syllabyss.tech/" } },
      { type: "deprecation", body: { id: "x" } },
    ];
    expect(violations(body)).toEqual([
      { directive: "img-src", blocked: "https://x.example/a.png", page: "https://syllabyss.tech/", source: undefined },
    ]);
  });

  it("ignores junk", () => {
    expect(violations(null)).toEqual([]);
    expect(violations("hi")).toEqual([]);
    expect(violations({ "csp-report": "nope" })).toEqual([]);
  });
});
