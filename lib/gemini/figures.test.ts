import { describe, expect, it } from "vitest";
import { cleanDescription, MAX_DESCRIPTION } from "./figures";

describe("cleanDescription", () => {
  it("fits in a markdown image's alt text: one line, no brackets or backticks", () => {
    expect(cleanDescription("A graph [left] with\n`dist[v]` labels.")).toBe("A graph (left) with 'dist(v)' labels.");
  });

  it("caps the length", () => {
    const s = cleanDescription("word ".repeat(400));
    expect(s.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(s.endsWith("…")).toBe(true);
  });
});
