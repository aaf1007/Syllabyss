import { createHash } from "node:crypto";
import sharp from "sharp";

// One image from an uploaded file → the WebP we store, or null when it isn't a Figure:
// too small to be more than a decoration, or a format we can't decode (EMF/WMF vector art).
// Transparent images are flattened onto white: diagrams drawn in black on a transparent
// background would vanish on the dark study view.

/** Longest side of a stored Figure. */
export const MAX_SIDE = 1600;
const WEBP_QUALITY = 80;
/** Smaller than this on its longest side, or thinner than MIN_THIN, is a decoration (bullet, icon, rule). */
const MIN_LONG_SIDE = 100;
const MIN_THIN = 32;

/** An image as the extractors give it: an encoded file (PPTX/DOCX media) or decoded pixels (PDF). */
export type ImageInput =
  | { bytes: Uint8Array }
  | { pixels: { data: Uint8Array | Uint8ClampedArray; width: number; height: number; channels: 1 | 3 | 4 } };

export type PreparedImage = {
  /** Of the source image, so the same picture is recognised wherever it repeats. */
  sha256: string;
  /** The source's size: the cap keeps the largest. */
  sourceArea: number;
  webp: Uint8Array;
  width: number;
  height: number;
};

export function isDecoration(width: number, height: number): boolean {
  return Math.max(width, height) < MIN_LONG_SIDE || Math.min(width, height) < MIN_THIN;
}

export async function prepareImage(input: ImageInput): Promise<PreparedImage | null> {
  let image: ReturnType<typeof sharp>;
  let width: number;
  let height: number;
  let source: Uint8Array;
  try {
    if ("pixels" in input) {
      const p = input.pixels;
      ({ width, height } = p);
      source = new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.byteLength);
      image = sharp(source, { raw: { width, height, channels: p.channels } });
    } else {
      source = input.bytes;
      image = sharp(source, { failOn: "none" });
      const meta = await image.metadata();
      if (!meta.width || !meta.height) return null;
      // EXIF rotation swaps the sides, but not which image is a decoration.
      ({ width, height } = meta);
    }
    if (isDecoration(width, height)) return null;
    const { data, info } = await image
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return {
      sha256: createHash("sha256").update(source).digest("hex"),
      sourceArea: width * height,
      webp: new Uint8Array(data),
      width: info.width,
      height: info.height,
    };
  } catch {
    return null; // not an image sharp can read
  }
}
