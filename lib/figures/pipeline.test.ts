import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { ALLOWED_TYPES } from "../documents/parsed-pages";
import { extractWithFigures } from "./pipeline";
import { localStore, type FigureStore } from "./store";

const fixture = (name: string) =>
  readFile(new URL(`../documents/extract/fixtures/${name}`, import.meta.url)).then((b) => new Uint8Array(b));
const tmpStore = async () => localStore(await mkdtemp(path.join(tmpdir(), "figures-test-")));

describe("extractWithFigures", () => {
  test("PPTX: the diagram becomes a described Figure, the logo on every slide doesn't", async () => {
    const store = await tmpStore();
    const calls: { pageNumber: number; text: string; images: number }[] = [];
    const { pages, figures } = await extractWithFigures(await fixture("deck-figures.pptx"), ALLOWED_TYPES.pptx, "Graphs", {
      store,
      describe: async (_title, page, images) => {
        calls.push({ ...page, images: images.length });
        return ["Two nodes joined by one edge."];
      },
    });

    expect(figures).toHaveLength(1);
    const [f] = figures;
    expect(f).toMatchObject({ pageIndex: 1, position: 0, width: 400, height: 300, description: "Two nodes joined by one edge." });
    expect(pages[1]).toMatch(new RegExp(`^# Minimum Spanning Trees\\n\\n!\\[Two nodes joined by one edge\\.\\]\\(figure:${f.id}\\)\\n\\n- Kruskal`));
    expect(pages.join("\n")).not.toMatch(/⟦FIG/);
    // Gemini saw the Page with the Figure's place marked
    expect(calls).toEqual([{ pageNumber: 2, text: expect.stringContaining("# Minimum Spanning Trees\n\n[Figure 1]\n\n- Kruskal"), images: 1 }]);

    const webp = await store.get(f.objectKey);
    expect(new TextDecoder().decode(webp!.slice(8, 12))).toBe("WEBP");
  });

  test("a failed description keeps the Figure with a generic one", async () => {
    const { pages, figures } = await extractWithFigures(await fixture("figures.pdf"), ALLOWED_TYPES.pdf, "Graphs", {
      store: await tmpStore(),
      describe: async () => {
        throw new Error("503");
      },
    });
    expect(figures.map((f) => f.description)).toEqual(["Figure on page 1"]);
    expect(pages[0]).toContain(`![Figure on page 1](figure:${figures[0].id})`);
  });

  test("a failed store write fails the upload and removes what was written", async () => {
    const deleted: string[] = [];
    const store: FigureStore = {
      put: async () => {
        throw new Error("R2 down");
      },
      signedUrl: async () => null,
      get: async () => null,
      delete: async (keys) => void deleted.push(...keys),
    };
    await expect(
      extractWithFigures(await fixture("styled-figures.docx"), ALLOWED_TYPES.docx, "Notes", { store, describe: async () => ["x"] }),
    ).rejects.toThrow(/couldn't save this file's images/);
    expect(deleted).toHaveLength(1);
  });

  test("a file without images has no Figures and its text is unchanged", async () => {
    const { pages, figures } = await extractWithFigures(await fixture("deck.pptx"), ALLOWED_TYPES.pptx, "Graphs", {
      store: await tmpStore(),
      describe: async () => {
        throw new Error("not called");
      },
    });
    expect(figures).toEqual([]);
    expect(pages[0]).toBe("# Graph Algorithms\n\nCMPT 307 · Week 9");
  });
});
