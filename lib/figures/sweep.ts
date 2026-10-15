import "server-only";
import { sql } from "@/lib/db";
import type { Db } from "@/lib/progress";
import { figureStore, type FigureStore } from "./store";

// Removes the stored images of deleted Figures. A trigger queues each deleted row's object in
// figure_orphans inside the deleting transaction (migration 20261014T1100_figures.sql), so every
// delete path (a Source Document, a Module, an account, a re-parse) only has to call this after
// it commits, usually from after(). Anything a crash leaves queued goes on the next sweep.

const BATCH = 500;

/** Deletes queued objects from the store, then their queue rows. Returns how many went. */
export async function sweepFigureOrphans(db: Db = sql, store: FigureStore = figureStore()): Promise<number> {
  let total = 0;
  for (;;) {
    const rows = await db<{ object_key: string }[]>`
      select object_key from figure_orphans order by queued_at limit ${BATCH}`;
    if (rows.length === 0) return total;
    const keys = rows.map((r) => r.object_key);
    await store.delete(keys);
    await db`delete from figure_orphans where object_key in ${db(keys)}`;
    total += keys.length;
    if (rows.length < BATCH) return total;
  }
}

/** sweepFigureOrphans for after(): logs instead of throwing. */
export function sweepFigureOrphansLater() {
  return sweepFigureOrphans().catch((e) => console.error("[figures] orphan sweep failed:", e));
}
