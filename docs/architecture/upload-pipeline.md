# Upload pipeline

Turns an uploaded file into stored, per-page text, and its images into **Figures** (ADR-0007). It runs **once per Source Document**, when the file is added to a Module. Game generation never re-parses; it reads the stored pages from Tiger Data. Parsing happens in the Next.js server with Node libraries; see ADR-0003 for why it isn't Snowflake.

## Flow

```
Module page (drop zone)
  │  multipart POST /api/modules/[moduleId]/documents
  │  Route Handler, not a Server Action: Server Actions cap request bodies at 1 MB by default
  ▼
1. Auth: the Clerk user owns the Module (else 404)
2. Validate: extension/MIME ∈ {pdf, pptx, docx}; size ≤ 25 MB (else 400 with a readable message)
3. INSERT source_documents (status = 'uploaded')  → respond 202 { document }
4. after(() => parseDocument(documentId, bytes))      // next/server; see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md

parseDocument:
  a. claim: UPDATE … SET status = 'parsing' WHERE status = 'uploaded'  (so it never runs twice)
  b. extractWithFigures(bytes, mimeType, filename)  (lib/figures/pipeline.ts; see Figures below)
       → one markdown string per page with ![description](figure:<id>) where each Figure was,
         and the Figure rows; the WebP images are already in the Figure store
  c. > 100 pages, or nothing readable on any page → fail with a readable message
  d. one transaction: INSERT source_pages (page_index, page_number = page_index + 1, content_md) for each page;
                      INSERT figures (source_page_id, position, object_key, size, sha256, description);
                      UPDATE source_documents SET status = 'parsed', page_count = n
  on any error: status = 'failed', error = <short user-facing message>; log the error (never the text) server-side;
                remove the images stored for this file
```

The bytes are not kept after parsing. The Module page re-fetches document status every ~3s while any file is `uploaded` or `parsing`. A `failed` file shows its error; the Player deletes it and uploads it again. There's no Retry: parsing is deterministic, so the same bytes would fail the same way.

### Status values

`uploaded → parsing → parsed`, or `→ failed`. Only `parsed` documents can be selected when creating a Game.

## Extraction (`lib/documents/extract/`)

| Type | Library | One "page" is | Structure kept |
|---|---|---|---|
| PDF | `unpdf` (pdf.js text layer) | a PDF page | Lines rebuilt from text positions; text ≥ 1.25× the body size → `#`/`##` heading; bullet glyphs → `- ` items; wide horizontal gaps → ` \| ` between columns. |
| PPTX | `jszip` + the slide XML | a slide, in deck order (`presentation.xml`), not file-name order | Title → `#`; body placeholders → bullets indented by level; tables → markdown tables; speaker notes appended as `Speaker notes:`; slide numbers, dates and footers dropped. |
| DOCX | `mammoth` (→ HTML → our markdown) | the text between explicit page breaks; with none, sections split at headings and packed up to ~3,000 characters | Heading styles → `#`–`####`; lists (nested) → `- `; tables → markdown tables. |

Known limits: math comes out as whatever characters the file contains. PDF tables come out as `a | b` lines rather than full markdown tables.

Page numbers shown to the Player are `page_index + 1` everywhere (Evidence, the reveal screen). For DOCX they're section numbers.

## Figures (`lib/figures/`, ADR-0007)

With an image sink (`extractPages(bytes, mimeType, sink)`), each extractor puts a marker (`⟦FIG:n⟧`, `lib/documents/extract/markers.ts`) where an image sits: PPTX pictures in shape order, DOCX images where mammoth finds them, PDF image XObjects placed among the lines by the height of their top edge. A PDF page with fewer than 25 characters in its text layer is a **scan**: it's rendered whole (`@napi-rs/canvas`, about 2000 px) and becomes one Figure.

`extractWithFigures` then:
1. converts each image to WebP (longest side 1600 px, transparency flattened onto white) and drops decorations: under 100 px on the longest side, or under 32 px on the shorter one, and formats sharp can't read (EMF/WMF);
2. keeps the Figures (`select.ts`): a picture on more than two Pages is a logo and goes everywhere; a repeat on one Page counts once; at most 40 per file, largest first; scans always stay;
3. asks Gemini, one call per Page with Figures (4 at a time), for a description of each (`lib/gemini/figures.ts`, the fast model first). A scanned Page gets a transcription instead, which becomes the Page's text below its Figure. A failed call keeps the Figure with "Figure on page N"; a file with nothing readable at all fails;
4. stores the WebPs (`store.ts`: R2 when `R2_*` is set, else `FIGURES_DIR`, default `./.figures`); a failed write fails the upload;
5. swaps each marker for `![description](figure:<id>)`. Generation, Evidence and matching read that text, so what a diagram shows can become a Prompt.

The study view, the Reveal's slide panel and study notes render `figure:` images from `GET /api/figures/<id>`: the owner of the file, or anyone when a public Game uses it, gets a redirect to a signed R2 URL valid for 5 minutes (the local store streams the bytes). Study notes keep each placeholder exactly (`keepFigures` in `lib/gemini/notes.ts`).

Deleting a Figure row (by cascade from a Page, Source Document, Module or Player) queues its object in `figure_orphans` through a trigger, in the same transaction. Every delete path then calls `sweepFigureOrphansLater()` in `after()`, which removes queued objects from the store.

Test any file without the app: `npm run parse:check -- path/to/file.pdf [--full]`.

## Code layout

| File | Responsibility |
|---|---|
| `app/api/modules/[moduleId]/documents/route.ts` | GET list, POST upload (validate, insert, schedule `after`) |
| `app/api/documents/[documentId]/route.ts` | GET status, DELETE (with the in-use guard) |
| `lib/documents/extract/{index,pdf,pptx,docx}.ts` | `extractPages(bytes, mimeType)` and one extractor per type |
| `lib/documents/parsed-pages.ts` | `validateUpload`, `toParsedPages` (page rules), shared constants |
| `lib/documents/parse-document.ts` | The `parseDocument` steps above |

`next.config.ts` lists `unpdf` and `mammoth` in `serverExternalPackages` and raises `experimental.proxyClientMaxBodySize` to 26 MB, because `proxy.ts` otherwise truncates request bodies at 10 MB.

## Deleting a Source Document

Deletion is **blocked while any Game uses the file** (a `game_sources` row exists). The API returns 409 and the UI shows "Used by N Games. Delete those Games first." When the file is free, deleting the `source_documents` row cascades to `source_pages`.

## Encoding

Text is stored as UTF-8 and normalized to NFC (so "Borůvka" typed by a Player matches "Borůvka" in a PDF that stores the accent as a separate mark). If mojibake ("BorÅ¯vka") ever appears, something is decoding UTF-8 as Latin-1.

## Deployment note

On Vercel, function request bodies are capped at 4.5 MB, which is below our 25 MB limit. If we deploy there, upload from the browser straight to storage first and have the server fetch it from there. When running locally or on a container host, no change is needed. See the open questions in `overview.md`.
