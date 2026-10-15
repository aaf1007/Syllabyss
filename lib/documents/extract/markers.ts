import type { ImageInput } from "../../figures/images.ts";

// While a file is extracted, each image it keeps sits in the page text as a marker ("⟦FIG:3⟧",
// like docx.ts's page-break marker), so the Figure lands where the image was. parseDocument
// swaps markers for ![description](figure:<id>) or removes them (lib/figures/pipeline.ts).

/**
 * Called once per image the extractor finds, in page order. Returns the marker to place in the
 * text, or null to drop the image. Without a sink, extractors skip images. `scan` marks a whole
 * PDF page rendered because it has (almost) no text layer: Gemini transcribes it.
 */
export type ImageSink = (image: ImageInput, options?: { scan?: boolean }) => Promise<string | null>;

export const figureMarker = (n: number) => `⟦FIG:${n}⟧`;
export const FIGURE_MARKER = /⟦FIG:(\d+)⟧/g;

/** Page text with markers replaced (`replace(n)` returns "" to drop one), blank runs tidied. */
export function replaceMarkers(text: string, replace: (n: number) => string): string {
  if (!text.includes("⟦FIG:")) return text;
  return text
    .replace(FIGURE_MARKER, (_, n) => replace(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
