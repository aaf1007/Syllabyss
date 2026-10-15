// Integration tests for Figures (#7): who may see one, and cleaning up a deleted one's image.
// Run with `npm run test:db`. Everything happens in a rolled-back transaction.
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { getVisibleFigureKey } from "./queries";
import type { FigureStore } from "./store";
import { sweepFigureOrphans } from "./sweep";

type Tx = postgres.TransactionSql;
class Rollback extends Error {}

type F = { tx: Tx; me: string; other: string; doc: string; figure: string; key: string; module: string };

async function withFixture(fn: (f: F) => Promise<void>) {
  try {
    await sql.begin(async (tx) => {
      const [me, other] = [`test_fig7_${randomUUID()}`, `test_fig7_${randomUUID()}`];
      await tx`insert into players (id) values (${me}), (${other})`;
      const [{ id: module }] = await tx`insert into modules (player_id, name) values (${me}, 'Graphs') returning id`;
      const [{ id: doc }] = await tx`
        insert into source_documents (module_id, player_id, filename, mime_type, size_bytes, status)
        values (${module}, ${me}, 'g.pdf', 'application/pdf', 1, 'parsed') returning id`;
      const [{ id: page }] = await tx`
        insert into source_pages (source_document_id, page_index, page_number, content_md)
        values (${doc}, 0, 1, '# MST') returning id`;
      const figure = randomUUID();
      const key = `figures/${figure}.webp`;
      await tx`insert into figures (id, source_page_id, position, object_key, width, height, sha256, description)
        values (${figure}, ${page}, 0, ${key}, 400, 300, 'abc', 'Two nodes.')`;
      await fn({ tx, me, other, doc, figure, key, module });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

describe("getVisibleFigureKey", () => {
  it("the owner sees their Figure; someone else doesn't", () =>
    withFixture(async ({ tx, me, other, figure, key }) => {
      expect(await getVisibleFigureKey(me, figure, tx)).toBe(key);
      expect(await getVisibleFigureKey(other, figure, tx)).toBeNull();
      expect(await getVisibleFigureKey(me, "not-a-uuid", tx)).toBeNull();
      expect(await getVisibleFigureKey(me, randomUUID(), tx)).toBeNull();
    }));

  it("anyone sees a Figure from a public Game's file", () =>
    withFixture(async ({ tx, me, other, doc, figure, key, module }) => {
      const game = randomUUID();
      await tx`insert into games (id, module_id, player_id, title, status, visibility) values (${game}, ${module}, ${me}, 'MST', 'ready', 'public')`;
      await tx`insert into game_sources (game_id, source_document_id) values (${game}, ${doc})`;
      expect(await getVisibleFigureKey(other, figure, tx)).toBe(key);
    }));
});

describe("deleted Figures", () => {
  it("deleting the Source Document queues the image; the sweep removes it and the queue row", () =>
    withFixture(async ({ tx, doc, key }) => {
      await tx`delete from source_documents where id = ${doc}`;
      const queued = await tx<{ object_key: string }[]>`select object_key from figure_orphans where object_key = ${key}`;
      expect(queued).toHaveLength(1);

      const deleted: string[] = [];
      const store: FigureStore = {
        put: async () => {},
        signedUrl: async () => null,
        get: async () => null,
        delete: async (keys) => void deleted.push(...keys),
      };
      await sweepFigureOrphans(tx, store);
      expect(deleted).toContain(key);
      expect(await tx`select 1 from figure_orphans where object_key = ${key}`).toHaveLength(0);
    }));
});
