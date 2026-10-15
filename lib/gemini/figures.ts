// Figure descriptions (#7, ADR-0007): at upload, one Gemini call per Page that has Figures, with
// the Page's text and its images. The descriptions go into the Page's content_md, so generation,
// Evidence and matching can use what a diagram shows while reading text only.
//
// Server only in the app, but no "server-only" import, like the other lib/gemini files.

import { defaultModels, generateJson, type JsonRequest } from "../gemini.ts";

/** Per attempt. A Player is waiting on the upload. */
const FIGURES_TIMEOUT_MS = 60_000;
/** Longest description we keep. */
export const MAX_DESCRIPTION = 600;

export const FIGURES_SYSTEM_INSTRUCTION = `You describe the figures (images) on one page of a student's lecture slides or notes, so the page can be studied and quizzed from its text alone.

The page's text is given with each figure's place marked as [Figure k], followed by the images in order.

For each figure, write a description that:
- Says what kind of figure it is (diagram, chart, graph, table, equation, code, screenshot, photo) and what it shows, in the context of the page.
- Transcribes the labels, numbers, equations and code in it that matter, exactly as written.
- For charts and graphs: the axes and the trend or key values. For diagrams: the parts and how they connect. For a table: its columns and key rows.
- Uses only what is visible. Don't add explanations, and don't guess at text you can't read.
- Is plain text: 1 to 4 sentences, at most ${MAX_DESCRIPTION} characters, no markdown, no line breaks. Don't begin with "This image" or "The figure shows".

If a figure is only decoration (a stock photo, clip art, a logo) with nothing to learn from it, say so in a few words, e.g. "Decorative photo of a laptop."`;

export const FIGURES_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    figures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          figure: { type: "integer", description: "k from [Figure k]." },
          description: { type: "string" },
        },
        required: ["figure", "description"],
      },
    },
  },
  required: ["figures"],
} as const;

/** The fast model first (GEMINI_FALLBACK_MODEL), then GEMINI_MODEL, like study notes. */
function figureModels(): string[] {
  const models = defaultModels();
  return models.length > 1 ? [models[1], models[0]] : models;
}

/**
 * Descriptions for one Page's Figures, in order. `text` marks each Figure's place as [Figure k]
 * (1-based). A Figure Gemini skips gets "" (the caller uses a generic description). Throws GeminiError.
 */
export async function describeFigures(
  title: string,
  page: { pageNumber: number; text: string },
  images: Uint8Array[],
): Promise<string[]> {
  const request: JsonRequest = {
    systemInstruction: FIGURES_SYSTEM_INSTRUCTION,
    responseSchema: FIGURES_RESPONSE_SCHEMA,
    temperature: 0.2,
    contents: [
      {
        role: "user",
        parts: [
          { text: `Document: ${title}\n\n=== Page ${page.pageNumber} ===\n${page.text}\n\n=== Figures ===` },
          ...images.flatMap((img, i) => [
            { text: `[Figure ${i + 1}]` },
            { inlineData: { mimeType: "image/webp", data: Buffer.from(img).toString("base64") } },
          ]),
          { text: `Describe each of the ${images.length} figure${images.length === 1 ? "" : "s"} following your instructions.` },
        ],
      },
    ],
  };
  const { response } = await generateJson(request, { models: figureModels(), timeoutMs: FIGURES_TIMEOUT_MS });
  const out = images.map(() => "");
  const figures = (response as { figures?: unknown })?.figures;
  if (Array.isArray(figures)) {
    for (const f of figures as { figure?: unknown; description?: unknown }[]) {
      const k = typeof f?.figure === "number" ? f.figure - 1 : -1;
      if (k >= 0 && k < out.length && typeof f.description === "string" && !out[k]) out[k] = cleanDescription(f.description);
    }
  }
  return out;
}

/**
 * One line of plain text that fits in a markdown image's alt text: no brackets or backticks
 * (they'd end or restyle it), collapsed whitespace, capped length.
 */
export function cleanDescription(text: string): string {
  const s = text
    .replace(/[\[\]]/g, (b) => (b === "[" ? "(" : ")"))
    .replace(/`/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > MAX_DESCRIPTION ? `${s.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : s;
}
