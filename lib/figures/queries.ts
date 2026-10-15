import "server-only";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/documents/queries";
import type { Db } from "@/lib/progress";

/**
 * The stored object of a Figure the Player may see: on a Page of their own Source Document, or of
 * one a public Game is generated from. Null for anyone else, a malformed id, or no such Figure.
 */
export async function getVisibleFigureKey(playerId: string, figureId: string, db: Db = sql): Promise<string | null> {
  if (!isUuid(figureId)) return null;
  const [row] = await db<{ object_key: string }[]>`
    select f.object_key
    from figures f
    join source_pages p on p.id = f.source_page_id
    join source_documents d on d.id = p.source_document_id
    where f.id = ${figureId}
      and (
        d.player_id = ${playerId}
        or exists (
          select 1 from game_sources gs join games g on g.id = gs.game_id
          where gs.source_document_id = d.id and g.visibility = 'public'
        )
      )`;
  return row?.object_key ?? null;
}
