import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractPages } from "./index.ts";
import { ALLOWED_TYPES } from "../parsed-pages.ts";
import { dropRepeatedLines, toLines, toMarkdown } from "./pdf.ts";
import { slideToMarkdown } from "./pptx.ts";
import { htmlToMarkdown, paginate } from "./docx.ts";
import { figureMarker } from "./markers.ts";

// Fixtures: lecture.pdf (2 pages, rendered by Chrome), deck.pptx (3 slides whose file
// order differs from deck order, a table, speaker notes), styled.docx (Word heading
// styles, a nested list, a table, a page break).
const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url)).then((b) => new Uint8Array(b));

test("PDF: headings by size, table columns kept, one string per page", async () => {
  const pages = await extractPages(await fixture("lecture.pdf"), ALLOWED_TYPES.pdf);
  assert.equal(pages.length, 2);
  assert.match(pages[0], /^# Week 9: Minimum Spanning Trees$/m);
  assert.match(pages[0], /^## Algorithms$/m);
  assert.match(pages[0], /Borůvka's algorithm merges components in rounds\./);
  assert.match(pages[0], /^Kruskal \| O\(E log E\)$/m);
  assert.match(pages[1], /^# Week 10: Shortest Paths$/m);
});

test("PPTX: deck order, title, nested bullets, table, notes; footers dropped", async () => {
  const pages = await extractPages(await fixture("deck.pptx"), ALLOWED_TYPES.pptx);
  assert.deepEqual(pages, [
    "# Graph Algorithms\n\nCMPT 307 · Week 9",
    "# Minimum Spanning Trees\n\n- Kruskal's algorithm sorts edges by weight\n  - Uses union–find\n- Prim's algorithm grows one tree\n- Borůvka merges components\n\nSpeaker notes:\nMention that Kruskal & Prim are both greedy.",
    "# Running times\n\n| Algorithm | Time |\n| --- | --- |\n| Kruskal | O(E log E) |\n| Prim | O(E log V) |",
  ]);
});

test("DOCX: heading styles, nested list, table, split at the page break", async () => {
  const pages = await extractPages(await fixture("styled.docx"), ALLOWED_TYPES.docx);
  assert.equal(pages.length, 2);
  assert.match(pages[0], /^# Week 9: Minimum Spanning Trees$/m);
  assert.match(pages[0], /^- Kruskal's algorithm sorts edges by weight\.\n {2}- Uses a union–find structure\.$/m);
  assert.match(pages[0], /^\| Kruskal \| O\(E log E\) \|$/m);
  assert.match(pages[1], /^# Week 10: Shortest Paths$/m);
  assert.match(pages[1], /negative weights & detects/);
});

test("a damaged file gives a readable error", async () => {
  const junk = new TextEncoder().encode("not really a pdf");
  await assert.rejects(extractPages(junk, ALLOWED_TYPES.pdf), /couldn't open this file/);
  await assert.rejects(extractPages(junk, ALLOWED_TYPES.pptx), /couldn't open this file/);
});

test("PDF lines: bullets become list items, big text becomes headings", () => {
  const item = (str: string, x: number, y: number, h: number) => ({ str, x, y, w: str.length * h * 0.5, h, eol: false });
  const md = toMarkdown(toLines([item("Title", 50, 700, 24), item("• first point", 50, 650, 12), item("• second", 50, 635, 12), item("plain text", 50, 600, 12)]));
  assert.equal(md, "# Title\n\n- first point\n- second\n\nplain text");
});

test("PPTX slide: sldNum/footer placeholders skipped, entities decoded", () => {
  const sp = (type: string, t: string) => `<p:sp><p:nvSpPr><p:nvPr><p:ph type="${type}"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`;
  assert.equal(slideToMarkdown(sp("title", "A &amp; B") + sp("sldNum", "7") + sp("ftr", "CMPT 307")), "# A & B");
});

test("DOCX: long text without breaks is packed into ~3000-char sections at headings", () => {
  const section = (n: number) => `## Part ${n}\n\n${"word ".repeat(400).trim()}`;
  const pages = paginate(htmlToMarkdown("") + [1, 2, 3, 4].map(section).join("\n\n"));
  assert.ok(pages.length >= 2 && pages.every((p) => p.length <= 3000));
  assert.ok(pages.every((p) => p.startsWith("## Part")));
});

test("PDF lines: symbol-font bullets, negative numbers stay numbers", () => {
  const line = (text: string, y: number) => ({ text, y, h: 12 });
  assert.equal(toMarkdown([line("\uF0A7 Course info", 700), line("\uF0A7 Python basics", 685)]), "- Course info\n- Python basics");
  assert.equal(toMarkdown([line("-1, -2, -3", 700)]), "-1, -2, -3");
  assert.equal(toMarkdown([line("- dash bullet", 700)]), "- dash bullet");
});

test("PDF: running footers and page-number lines are dropped", () => {
  const line = (text: string) => ({ text, y: 0, h: 12 });
  const pages = [1, 2, 3, 4, 5, 6].map((n) => [line(`Topic ${"ABCDEF"[n - 1]}`), line(String(n)), line(`Page ${n} of 6`), line("6.100L Lecture 1")]);
  pages[2].push(line("YOU TRY IT!"));
  pages[4].push(line("YOU TRY IT!"));
  const out = dropRepeatedLines(pages).map((p) => p.map((l) => l.text));
  assert.deepEqual(out[0], ["Topic A"]);
  assert.deepEqual(out[2], ["Topic C", "YOU TRY IT!"]);
});

// Figures (#7): deck-figures.pptx, styled-figures.docx and figures.pdf come from make-figure-fixtures.mts.
/** Extracts with a sink that numbers the images it's given and drops the ones `keep` refuses. */
async function withFigures(name: string, type: string, keep: (bytes: number) => boolean = () => true) {
  const seen: number[] = [];
  const pages = await extractPages(await fixture(name), type, async (img) => {
    const size = "bytes" in img ? img.bytes.length : img.pixels.width * img.pixels.height;
    seen.push(size);
    return keep(size) ? figureMarker(seen.length - 1) : null;
  });
  return { pages, seen };
}

test("PPTX Figures: a marker per picture, where it sits on the slide", async () => {
  const { pages, seen } = await withFigures("deck-figures.pptx", ALLOWED_TYPES.pptx);
  assert.equal(seen.length, 4); // the logo on each of the 3 slides + the diagram
  assert.match(pages[1], /^# Minimum Spanning Trees\n\n⟦FIG:1⟧\n\n- Kruskal/);
  assert.ok(pages.every((p) => /⟦FIG:\d+⟧/.test(p)));
});

test("DOCX Figures: marker after the paragraph it follows; a refused image leaves nothing", async () => {
  const { pages, seen } = await withFigures("styled-figures.docx", ALLOWED_TYPES.docx, (bytes) => bytes > 1000);
  assert.equal(seen.length, 2);
  assert.match(pages[0], /least total edge weight\.\n\n⟦FIG:0⟧\n\n## Algorithms/);
  assert.doesNotMatch(pages.join("\n"), /⟦FIG:1⟧|<img/);
});

test("PDF Figures: an image lands between the lines above and below it", async () => {
  const { pages, seen } = await withFigures("figures.pdf", ALLOWED_TYPES.pdf, (pixels) => pixels > 1000);
  assert.deepEqual(seen, [400 * 300, 16 * 16]);
  assert.match(pages[0], /connects every vertex\.\n\n⟦FIG:0⟧\n\nKruskal's algorithm/);
  assert.doesNotMatch(pages[1], /⟦FIG/);
});

test("without a sink, images are skipped", async () => {
  const pages = await extractPages(await fixture("deck-figures.pptx"), ALLOWED_TYPES.pptx);
  assert.doesNotMatch(pages.join("\n"), /⟦FIG/);
});

test("PDF Figure markers survive header/footer removal and stay their own block", () => {
  const marker = (n: number) => ({ text: figureMarker(n), y: 500, h: 0 });
  const pages = [0, 1, 2, 3].map((n) => [{ text: `Topic ${n}`, y: 700, h: 12 }, marker(n)]);
  const out = dropRepeatedLines(pages);
  assert.equal(toMarkdown(out[1]), "Topic 1\n\n⟦FIG:1⟧");
});

test("PDF: a page with no text layer is rendered whole and handed over as a scan", async () => {
  const calls: { scan: boolean; isPng: boolean }[] = [];
  const pages = await extractPages(await fixture("scanned.pdf"), ALLOWED_TYPES.pdf, async (img, options) => {
    calls.push({ scan: Boolean(options?.scan), isPng: "bytes" in img && img.bytes[1] === 0x50 }); // "\x89PNG"
    return figureMarker(calls.length - 1);
  });
  assert.deepEqual(calls, [{ scan: true, isPng: true }]); // the text page's images aren't asked for
  assert.equal(pages[0], "⟦FIG:0⟧");
  assert.match(pages[1], /A binary heap/);
});
