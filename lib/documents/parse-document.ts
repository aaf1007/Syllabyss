import "server-only";
import { sql } from "@/lib/db";
import { extractWithFigures } from "@/lib/figures/pipeline";
import { figureStore } from "@/lib/figures/store";
import { sweepFigureOrphansLater } from "@/lib/figures/sweep";
import { toParsedPages, UserFacingError } from "./parsed-pages";

// The upload pipeline (docs/architecture/upload-pipeline.md): file bytes → Node
// extraction (ADR-0003) → Figures described and stored (ADR-0007) → source_pages + figures.
// Runs in `after()`, so it never throws: every failure ends with status 'failed' and a short
// message the Player can read. The bytes aren't kept; a failed file is deleted and uploaded again.

export async function parseDocument(documentId: string, bytes: Uint8Array) {
  // Claim the document atomically so two runs never parse the same file at once.
  const [doc] = await sql<{ mime_type: string; filename: string }[]>`
    update source_documents set status = 'parsing', error = null
    where id = ${documentId} and status = 'uploaded'
    returning mime_type, filename`;
  if (!doc) return;

  const store = figureStore();
  let stored: string[] = []; // object keys written, until the rows that own them commit
  try {
    const extracted = await extractWithFigures(bytes, doc.mime_type, doc.filename, { store });
    stored = extracted.figures.map((f) => f.objectKey);
    const pages = toParsedPages(extracted.pages);

    await sql.begin(async (tx) => {
      await tx`delete from source_pages where source_document_id = ${documentId}`;
      const rows = await tx<{ id: string; page_index: number }[]>`
        insert into source_pages ${tx(
          pages.map((p) => ({
            source_document_id: documentId,
            page_index: p.pageIndex,
            page_number: p.pageNumber,
            content_md: p.contentMd,
          })),
        )}
        returning id, page_index`;
      if (extracted.figures.length) {
        const pageId = new Map(rows.map((r) => [r.page_index, r.id]));
        await tx`
          insert into figures ${tx(
            extracted.figures.map((f) => ({
              id: f.id,
              source_page_id: pageId.get(f.pageIndex)!,
              position: f.position,
              object_key: f.objectKey,
              width: f.width,
              height: f.height,
              sha256: f.sha256,
              description: f.description,
            })),
          )}`;
      }
      await tx`
        update source_documents set status = 'parsed', page_count = ${pages.length}, error = null
        where id = ${documentId}`;
    });
    stored = [];
  } catch (err) {
    // Log the error, never the document text.
    const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : "";
    console.error(`parseDocument ${documentId} failed: ${err instanceof Error ? err.message : err}${cause}`);
    const message = err instanceof UserFacingError ? err.message : "We couldn't read this file. Delete it and upload it again";
    await sql`update source_documents set status = 'failed', error = ${message} where id = ${documentId}`.catch(
      (e) => console.error(`parseDocument ${documentId}: couldn't record failure:`, e),
    );
    // Images stored for rows that never committed
    await store.delete(stored).catch((e) => console.error(`parseDocument ${documentId}: couldn't remove images:`, e));
  }
  await sweepFigureOrphansLater(); // a re-parse queued the old Figures' images
}
