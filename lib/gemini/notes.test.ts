import { describe, expect, it } from "vitest";
import { cleanNotes, keepFigures, MAX_NOTES } from "./notes";

describe("cleanNotes", () => {
  it("unwraps a code fence around the whole answer", () => {
    expect(cleanNotes("```markdown\n## Title\n\n- a\n```")).toBe("## Title\n\n- a");
  });

  it("keeps inner code spans and comparison signs", () => {
    expect(cleanNotes("Use `P(A|B)` when a<b and c>d")).toBe("Use `P(A|B)` when a<b and c>d");
  });

  it("caps the length", () => {
    expect(cleanNotes("x".repeat(MAX_NOTES + 50))).toHaveLength(MAX_NOTES);
  });
});

describe("keepFigures", () => {
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  const page = `# MST\n\n![Two nodes joined by an edge.](figure:${a})\n\n- Kruskal\n\n![A weighted graph.](figure:${b})`;

  it("leaves Figures Gemini copied alone", () => {
    const notes = `## MST\n\n![Two nodes joined by an edge.](figure:${a})\n\n- **Kruskal**\n\n![A weighted graph.](figure:${b})`;
    expect(keepFigures(page, notes)).toBe(notes);
  });

  it("restores a reworded description, drops a made-up Figure, appends a dropped one", () => {
    const notes = `## MST\n\n![Nodes.](figure:${a})\n\n![Made up.](figure:33333333-3333-4333-8333-333333333333)\n\n- Kruskal`;
    expect(keepFigures(page, notes)).toBe(
      `## MST\n\n![Two nodes joined by an edge.](figure:${a})\n\n- Kruskal\n\n![A weighted graph.](figure:${b})`,
    );
  });
});
