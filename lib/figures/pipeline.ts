import { randomUUID } from "node:crypto";
import { extractPages } from "../documents/extract/index.ts";
import { FIGURE_MARKER, figureMarker, replaceMarkers } from "../documents/extract/markers.ts";
import { UserFacingError } from "../documents/parsed-pages.ts";
import { describeFigures, transcribeScan } from "../gemini/figures.ts";
import { prepareImage, type PreparedImage } from "./images.ts";
import { selectFigures } from "./select.ts";
import type { FigureStore } from "./store.ts";

// The upload pipeline's Figure step (#7, ADR-0007): extract the file's text with a marker for
// each usable image, keep the images that are Figures (./select.ts), have Gemini describe them
// one Page at a time, store the WebPs, and put ![description](figure:<id>) where each marker was.
// A scanned PDF page (no text layer) is one whole-page Figure, and the text Gemini reads off it
// becomes the Page's text. A failed description keeps its Figure with a generic one; a failed
// store fails the upload, because the image bytes can't be fetched again once the request is over.

/** Images converted while extracting, before selection: bounds memory on picture-heavy files. */
const MAX_CANDIDATES = 300;
/** Gemini calls (one per Page) and store writes in flight at once. */
const DESCRIBE_CONCURRENCY = 4;
const STORE_CONCURRENCY = 6;

export type FigureRow = {
  id: string;
  pageIndex: number;
  position: number;
  objectKey: string;
  width: number;
  height: number;
  sha256: string;
  description: string;
};

export type ExtractedDocument = { pages: string[]; figures: FigureRow[] };

export type FigureDeps = {
  store: FigureStore;
  describe?: typeof describeFigures;
  transcribe?: typeof transcribeScan;
};

export const objectKeyFor = (id: string) => `figures/${id}.webp`;
export const genericDescription = (pageNumber: number) => `Figure on page ${pageNumber}`;
export const figurePlaceholder = (id: string, description: string) => `![${description}](figure:${id})`;

export async function extractWithFigures(
  bytes: Uint8Array,
  mimeType: string,
  title: string,
  { store, describe = describeFigures, transcribe = transcribeScan }: FigureDeps,
): Promise<ExtractedDocument> {
  const prepared: PreparedImage[] = [];
  const scans = new Set<number>(); // markers of whole scanned pages
  const pages = await extractPages(bytes, mimeType, async (image, options) => {
    if (!options?.scan && prepared.length >= MAX_CANDIDATES) return null;
    const p = await prepareImage(image);
    if (!p) return null;
    prepared.push(p);
    if (options?.scan) scans.add(prepared.length - 1);
    return figureMarker(prepared.length - 1);
  });

  // Each marker's Page (a marker can repeat on its own Page: the same picture placed twice).
  const pageOf = new Map<number, number>();
  pages.forEach((text, pageIndex) => {
    for (const m of text.matchAll(FIGURE_MARKER)) if (!pageOf.has(Number(m[1]))) pageOf.set(Number(m[1]), pageIndex);
  });
  // A scan is always kept: it's the Page's only source of text.
  const kept = selectFigures(
    [...pageOf]
      .filter(([n]) => !scans.has(n))
      .map(([n, pageIndex]) => ({ n, pageIndex, sha256: prepared[n].sha256, sourceArea: prepared[n].sourceArea })),
  );
  for (const n of scans) if (pageOf.has(n)) kept.add(n);

  // Per Page, its Figures in reading order.
  const byPage = new Map<number, number[]>();
  for (const [n, pageIndex] of pageOf) if (kept.has(n)) byPage.set(pageIndex, [...(byPage.get(pageIndex) ?? []), n]);

  const idOf = new Map<number, FigureRow>(); // marker → its Figure
  const transcripts = new Map<number, string>(); // scan marker → the Page's text, read by Gemini
  await eachLimit([...byPage], DESCRIBE_CONCURRENCY, async ([pageIndex, ns]) => {
    const pageNumber = pageIndex + 1;
    let descriptions: string[] = [];
    try {
      if (ns.length === 1 && scans.has(ns[0])) {
        const read = await transcribe(title, pageNumber, prepared[ns[0]].webp);
        transcripts.set(ns[0], read.textMd);
        descriptions = [read.description];
      } else {
        const k = new Map(ns.map((n, i) => [n, i + 1]));
        const text = replaceMarkers(pages[pageIndex], (n) => (k.has(n) ? `[Figure ${k.get(n)}]` : ""));
        descriptions = await describe(title, { pageNumber, text }, ns.map((n) => prepared[n].webp));
      }
    } catch (err) {
      console.error(`Figures on page ${pageNumber} weren't described: ${err instanceof Error ? err.message : err}`);
    }
    ns.forEach((n, position) => {
      const id = randomUUID();
      idOf.set(n, {
        id,
        pageIndex,
        position,
        objectKey: objectKeyFor(id),
        width: prepared[n].width,
        height: prepared[n].height,
        sha256: prepared[n].sha256,
        description: descriptions[position] || genericDescription(pageNumber),
      });
    });
  });

  // The first copy of each kept marker on its Page becomes the placeholder (a scan's followed by
  // the text Gemini read); everything else goes.
  const placed = new Set<number>();
  const out = pages.map((text) =>
    replaceMarkers(text, (n) => {
      const f = idOf.get(n);
      if (!f || placed.has(n)) return "";
      placed.add(n);
      const transcript = transcripts.get(n);
      return figurePlaceholder(f.id, f.description) + (transcript ? `\n\n${transcript}` : "");
    }),
  );
  const figures = [...idOf.values()].sort((a, b) => a.pageIndex - b.pageIndex || a.position - b.position);

  // Nothing readable: no text outside the Figures, and no Figure Gemini could describe (a scan it couldn't read).
  const textOutsideFigures = out.some((t) => t.replace(/!\[[^\]]*\]\(figure:[0-9a-f-]+\)/g, "").trim());
  if (scans.size && !textOutsideFigures && figures.every((f) => f.description === genericDescription(f.pageIndex + 1))) {
    throw new UserFacingError("We couldn't read this scanned file. Delete it and upload it again");
  }

  try {
    await eachLimit([...idOf], STORE_CONCURRENCY, ([n, f]) => store.put(f.objectKey, prepared[n].webp, "image/webp"));
  } catch (err) {
    await store.delete(figures.map((f) => f.objectKey)).catch(() => {});
    throw new UserFacingError("We couldn't save this file's images. Delete it and upload it again", { cause: err });
  }
  return { pages: out, figures };
}

/** Runs `fn` over `items`, at most `limit` at a time; rejects with the first error. */
async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
