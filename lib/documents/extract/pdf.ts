import { getDocumentProxy, getResolvedPDFJS, renderPageAsImage } from "unpdf";
import type { ImageSink } from "./markers.ts";

// PDF → one markdown string per page, from the PDF's text layer (pdf.js via unpdf).
// Rebuilds lines from text positions, marks larger text as headings and bullet
// glyphs as list items, keeps wide gaps between runs as " | " so table rows stay
// readable, and drops headers/footers that repeat on most pages (slide numbers,
// course names). Scanned pages have no text layer and come back as "".
// With a sink, each embedded image becomes a Figure marker on its own line, placed by
// the height of the image's top edge among the text lines, and a page with almost no text
// (a scan) is rendered whole and handed over as a scan instead.

type Item = { str: string; x: number; y: number; w: number; h: number; eol: boolean };
type Line = { text: string; y: number; h: number };

// Bullet glyphs, including symbol-font bullets (Wingdings etc.) that land in the Unicode
// private-use area. A dash or asterisk only counts when a space follows, so "-1" stays a number.
const BULLET = /^(?:[•▪◦‣●○■□►▶➢✓✔\uE000-\uF8FF]\s*|[–—\-*]\s+)/;
const PRIVATE_USE = /[\uE000-\uF8FF]/g;
// A line on at least this share of pages (and at least 3) is a header or footer.
const REPEATED_SHARE = 0.5;
const HEADING_RATIO = 1.25; // line height vs the page's typical body height
const COLUMN_GAP = 1; // gap wider than this many text heights = a new column

export class TooManyPagesError extends Error {}

export async function extractPdf(bytes: Uint8Array, maxPages = Infinity, sink?: ImageSink): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { OPS } = await getResolvedPDFJS();
  try {
    if (pdf.numPages > maxPages) throw new TooManyPagesError(`${pdf.numPages} pages`);
    const pages: Line[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const it of content.items) {
        if (!("str" in it)) continue;
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.height || it.transform[3]), eol: it.hasEOL });
      }
      const lines = toLines(items);
      if (sink && isScan(lines)) {
        const marker = await sink({ bytes: await renderPage(pdf, n) }, { scan: true });
        if (marker) lines.unshift({ text: marker, y: Infinity, h: 0 });
      } else if (sink) {
        for (const img of await pageImages(page, OPS, sink)) placeLine(lines, { text: img.marker, y: img.top, h: 0 });
      }
      pages.push(lines);
      page.cleanup();
    }
    return dropRepeatedLines(pages).map(toMarkdown);
  } finally {
    await pdf.loadingTask.destroy(); // frees the worker and document memory
  }
}

type PdfPage = Awaited<ReturnType<Awaited<ReturnType<typeof getDocumentProxy>>["getPage"]>>;
type Ops = Awaited<ReturnType<typeof getResolvedPDFJS>>["OPS"];
type Matrix = [number, number, number, number, number, number];

/** How long to wait for pdf.js to hand over one decoded image. */
const IMAGE_TIMEOUT_MS = 10_000;
/** A page with fewer characters than this in its text layer is treated as a scan. */
const SCAN_MAX_CHARS = 25;
/** Longest side a scanned page is rendered at, for Gemini to read. */
const SCAN_RENDER_PX = 2000;

export function isScan(lines: Line[]): boolean {
  return lines.reduce((n, l) => n + l.text.replace(/\s/g, "").length, 0) < SCAN_MAX_CHARS;
}

/** The whole page as a PNG, its longest side SCAN_RENDER_PX. */
async function renderPage(pdf: Awaited<ReturnType<typeof getDocumentProxy>>, pageNumber: number): Promise<Uint8Array> {
  const page = await pdf.getPage(pageNumber);
  const { width, height } = page.getViewport({ scale: 1 });
  const scale = SCAN_RENDER_PX / Math.max(width, height);
  const png = await renderPageAsImage(pdf, pageNumber, { canvasImport: () => import("@napi-rs/canvas"), scale });
  return new Uint8Array(png);
}

/**
 * The page's images, in drawing order, with the y of each one's top edge (PDF user space, like
 * the text positions). Follows the current transform through save/restore, cm and form XObjects;
 * an image is drawn into the unit square of the transform in effect.
 */
async function pageImages(page: PdfPage, OPS: Ops, sink: ImageSink) {
  const { fnArray, argsArray } = await page.getOperatorList();
  const out: { top: number; marker: string }[] = [];
  const seen = new Set<string>();
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = multiply(ctm, args as Matrix);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      if (Array.isArray(args?.[0]) && args[0].length === 6) ctm = multiply(ctm, args[0] as Matrix);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.paintImageXObject) {
      const key = String(args[0]);
      if (seen.has(key)) continue;
      seen.add(key);
      const img = await imageObject(page, key);
      if (!img) continue;
      const channels = img.data.length / (img.width * img.height);
      if (channels !== 1 && channels !== 3 && channels !== 4) continue; // 1-bit masks and the like
      const marker = await sink({ pixels: { data: img.data, width: img.width, height: img.height, channels } });
      if (marker) out.push({ top: ctm[5] + Math.max(0, ctm[1]) + Math.max(0, ctm[3]), marker });
    }
  }
  return out;
}

function imageObject(page: PdfPage, key: string) {
  type Img = { data?: Uint8Array | Uint8ClampedArray; width?: number; height?: number } | null;
  const objs = key.startsWith("g_") ? page.commonObjs : page.objs;
  return Promise.race([
    new Promise<Img>((resolve) => objs.get(key, resolve)),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), IMAGE_TIMEOUT_MS).unref()),
  ]).then((img) => (img?.data && img.width && img.height ? { data: img.data, width: img.width, height: img.height } : null));
}

/** m applied first, then ctm (PDF's `cm`). */
function multiply(ctm: Matrix, m: Matrix): Matrix {
  const [a, b, c, d, e, f] = ctm;
  return [a * m[0] + c * m[1], b * m[0] + d * m[1], a * m[2] + c * m[3], b * m[2] + d * m[3], a * m[4] + c * m[5] + e, b * m[4] + d * m[5] + f];
}

/** Inserts a line among lines sorted top to bottom. */
export function placeLine(lines: Line[], line: Line) {
  const at = lines.findIndex((l) => l.y < line.y);
  lines.splice(at === -1 ? lines.length : at, 0, line);
}

const isMarker = (text: string) => text.startsWith("\u27e6FIG:");

/** Groups text runs into visual lines, top to bottom, left to right. */
export function toLines(items: Item[]): Line[] {
  const runs = items.filter((i) => i.str.trim() !== "");
  runs.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: Item[][] = [];
  for (const it of runs) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - it.y) <= Math.max(2, 0.4 * Math.max(row[0].h, it.h))) row.push(it);
    else rows.push([it]);
  }

  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    const h = Math.max(...row.map((r) => r.h));
    let text = "";
    let end = -Infinity;
    for (const r of row) {
      const gap = r.x - end;
      if (text && gap > COLUMN_GAP * h) text += " | ";
      else if (text && gap > 0.15 * h && !text.endsWith(" ") && !r.str.startsWith(" ")) text += " ";
      text += r.str;
      end = r.x + r.w;
    }
    return { text: text.replace(/\s+/g, " ").trim(), y: row[0].y, h };
  });
}

/**
 * Removes running headers and footers: lines that appear (ignoring digits) on most
 * pages, and lines that are just the page's own number.
 */
export function dropRepeatedLines(pages: Line[][]): Line[][] {
  // A line counts as repeated if its exact text, or its text with the page's own number
  // masked, is on most pages: "6.100L Lecture 1" everywhere, "Page 3 of 57" on page 3.
  const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
  const masked = (text: string, page: number) => norm(text).replace(new RegExp(`(?<!\\d)${page}(?!\\d)`, "g"), "#");
  const counts = new Map<string, number>();
  pages.forEach((lines, i) => {
    const keys = new Set(lines.flatMap((l) => [`=${norm(l.text)}`, `#${masked(l.text, i + 1)}`]));
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  const threshold = Math.max(3, REPEATED_SHARE * pages.length);
  const repeated = (text: string, page: number) =>
    (counts.get(`=${norm(text)}`) ?? 0) >= threshold || (counts.get(`#${masked(text, page)}`) ?? 0) >= threshold;
  return pages.map((lines, i) => lines.filter((l) => isMarker(l.text) || (!repeated(l.text, i + 1) && l.text !== String(i + 1))));
}

export function toMarkdown(lines: Line[]): string {
  if (lines.length === 0) return "";
  const body = median(lines.filter((l) => l.h > 0).map((l) => l.h)); // Figure markers have no height
  const out: string[] = [];
  let prev: Line | undefined;

  for (const line of lines) {
    const ratio = line.h / body;
    let text = line.text;
    if (ratio >= HEADING_RATIO && text.length <= 120) {
      text = `${ratio >= 1.8 ? "#" : "##"} ${text}`;
    } else if (BULLET.test(text)) {
      text = `- ${text.replace(BULLET, "")}`;
    }
    text = text.replace(PRIVATE_USE, "").trim(); // stray icon glyphs
    if (!text || text === "-" || /^#+$/.test(text)) continue;
    // A blank line between blocks: before headings and list items, and at wide vertical gaps.
    const gap = prev ? prev.y - line.y : 0;
    const last = out[out.length - 1] ?? "";
    const listStart = text.startsWith("- ") && !last.startsWith("- ");
    const newBlock =
      !prev || text.startsWith("#") || listStart || last.startsWith("#") || isMarker(text) || isMarker(last) || gap > 1.8 * Math.max(prev.h, line.h);
    if (prev && newBlock) out.push("");
    out.push(text);
    prev = line;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 1;
}
