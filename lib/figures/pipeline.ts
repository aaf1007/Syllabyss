import { randomUUID } from "node:crypto";
import { extractPages } from "../documents/extract/index.ts";
import { FIGURE_MARKER, figureMarker, replaceMarkers } from "../documents/extract/markers.ts";
import { UserFacingError } from "../documents/parsed-pages.ts";
import { describeFigures } from "../gemini/figures.ts";
import { prepareImage, type PreparedImage } from "./images.ts";
import { selectFigures } from "./select.ts";
import type { FigureStore } from "./store.ts";

// The upload pipeline's Figure step (#7, ADR-0007): extract the file's text with a marker for
// each usable image, keep the images that are Figures (./select.ts), have Gemini describe them
// one Page at a time, store the WebPs, and put ![description](figure:<id>) where each marker was.
// A failed description keeps its Figure with a generic one; a failed store fails the upload,
// because the image bytes can't be fetched again once the request is over.

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
};

export const objectKeyFor = (id: string) => `figures/${id}.webp`;
export const genericDescription = (pageNumber: number) => `Figure on page ${pageNumber}`;
export const figurePlaceholder = (id: string, description: string) => `![${description}](figure:${id})`;

export async function extractWithFigures(
  bytes: Uint8Array,
  mimeType: string,
  title: string,
  { store, describe = describeFigures }: FigureDeps,
): Promise<ExtractedDocument> {
  const prepared: PreparedImage[] = [];
  const pages = await extractPages(bytes, mimeType, async (image) => {
    if (prepared.length >= MAX_CANDIDATES) return null;
    const p = await prepareImage(image);
    if (!p) return null;
    prepared.push(p);
    return figureMarker(prepared.length - 1);
  });

  // Each marker's Page (a marker can repeat on its own Page: the same picture placed twice).
  const pageOf = new Map<number, number>();
  pages.forEach((text, pageIndex) => {
    for (const m of text.matchAll(FIGURE_MARKER)) if (!pageOf.has(Number(m[1]))) pageOf.set(Number(m[1]), pageIndex);
  });
  const kept = selectFigures(
    [...pageOf].map(([n, pageIndex]) => ({ n, pageIndex, sha256: prepared[n].sha256, sourceArea: prepared[n].sourceArea })),
  );

  // Per Page, its Figures in reading order.
  const byPage = new Map<number, number[]>();
  for (const [n, pageIndex] of pageOf) if (kept.has(n)) byPage.set(pageIndex, [...(byPage.get(pageIndex) ?? []), n]);

  const idOf = new Map<number, FigureRow>(); // marker → its Figure
  await eachLimit([...byPage], DESCRIBE_CONCURRENCY, async ([pageIndex, ns]) => {
    const k = new Map(ns.map((n, i) => [n, i + 1]));
    const text = replaceMarkers(pages[pageIndex], (n) => (k.has(n) ? `[Figure ${k.get(n)}]` : ""));
    let descriptions: string[] = [];
    try {
      descriptions = await describe(title, { pageNumber: pageIndex + 1, text }, ns.map((n) => prepared[n].webp));
    } catch (err) {
      console.error(`Figure descriptions for page ${pageIndex + 1} failed: ${err instanceof Error ? err.message : err}`);
    }
    ns.forEach((n, position) => {
      const id = randomUUID();
      const row: FigureRow = {
        id,
        pageIndex,
        position,
        objectKey: objectKeyFor(id),
        width: prepared[n].width,
        height: prepared[n].height,
        sha256: prepared[n].sha256,
        description: descriptions[position] || genericDescription(pageIndex + 1),
      };
      idOf.set(n, row);
    });
  });

  const figures = [...idOf.values()].sort((a, b) => a.pageIndex - b.pageIndex || a.position - b.position);
  try {
    await eachLimit([...idOf], STORE_CONCURRENCY, ([n, f]) => store.put(f.objectKey, prepared[n].webp, "image/webp"));
  } catch (err) {
    await store.delete(figures.map((f) => f.objectKey)).catch(() => {});
    throw new UserFacingError("We couldn't save this file's images. Delete it and upload it again", { cause: err });
  }

  // The first copy of each kept marker on its Page becomes the placeholder; everything else goes.
  const placed = new Set<number>();
  const out = pages.map((text) =>
    replaceMarkers(text, (n) => {
      const f = idOf.get(n);
      if (!f || placed.has(n)) return "";
      placed.add(n);
      return figurePlaceholder(f.id, f.description);
    }),
  );
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
