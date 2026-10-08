// Integration tests for deleting a Module (#9). Run with `npm run test:db`.
// Everything happens in a rolled-back transaction.
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { deleteModule } from "./delete-module";

type Tx = postgres.TransactionSql;
class Rollback extends Error {}

type F = { tx: Tx; me: string; module: string; keep: string; doc: string; game: string; keepGame: string; run: string };

async function withFixture(fn: (f: F) => Promise<void>) {
  try {
    await sql.begin(async (tx) => {
      const me = `test_delmod9_${randomUUID()}`;
      await tx`insert into players (id) values (${me})`;
      const [{ id: module }] = await tx`insert into modules (player_id, name) values (${me}, 'CMPT 354') returning id`;
      const [{ id: keep }] = await tx`insert into modules (player_id, name) values (${me}, 'Keep') returning id`;
      const [{ id: doc }] = await tx`
        insert into source_documents (module_id, player_id, filename, mime_type, size_bytes, status)
        values (${module}, ${me}, 'sql.pdf', 'application/pdf', 1, 'parsed') returning id`;
      await tx`insert into source_pages (source_document_id, page_index, page_number, content_md) values (${doc}, 0, 1, '# SQL')`;
      const [game, keepGame, run, keepRun] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
      await tx`insert into games (id, module_id, player_id, title, status) values
        (${game}, ${module}, ${me}, 'SQL', 'ready'), (${keepGame}, ${keep}, ${me}, 'Kept', 'ready')`;
      await tx`insert into game_sources (game_id, source_document_id) values (${game}, ${doc})`;
      await tx`insert into runs (id, player_id, game_id, status) values
        (${run}, ${me}, ${game}, 'finished'), (${keepRun}, ${me}, ${keepGame}, 'finished')`;
      await tx`insert into guess_events (player_id, game_id, run_id, prompt_id, position, raw_text, match_method, is_correct, ms_into_prompt) values
        (${me}, ${game}, ${run}, ${randomUUID()}, 0, 'select', 'none', false, 100),
        (${me}, ${keepGame}, ${keepRun}, ${randomUUID()}, 0, 'join', 'none', false, 100)`;
      await tx`insert into xp_events (player_id, amount, reason, ref) values (${me}, 50, 'run_finished', ${run})`;
      await fn({ tx, me, module, keep, doc, game, keepGame, run });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

const count = async (q: postgres.PendingQuery<{ n: number }[]>) => (await q)[0].n;

describe("deleteModule", () => {
  it("deletes the Module with its files, pages, Games, Runs and guesses, and nothing else", () =>
    withFixture(async (f) => {
      const { tx } = f;
      expect(await deleteModule(f.me, f.module, tx)).toBe(true);

      expect(await count(tx`select count(*)::int as n from modules where id = ${f.module}`)).toBe(0);
      expect(await count(tx`select count(*)::int as n from source_documents where id = ${f.doc}`)).toBe(0);
      expect(await count(tx`select count(*)::int as n from source_pages where source_document_id = ${f.doc}`)).toBe(0);
      expect(await count(tx`select count(*)::int as n from games where id = ${f.game}`)).toBe(0);
      expect(await count(tx`select count(*)::int as n from runs where id = ${f.run}`)).toBe(0);
      expect(await count(tx`select count(*)::int as n from guess_events where game_id = ${f.game}`)).toBe(0);

      // The other Module, its guesses, and XP already earned stay.
      expect(await count(tx`select count(*)::int as n from modules where id = ${f.keep}`)).toBe(1);
      expect(await count(tx`select count(*)::int as n from guess_events where game_id = ${f.keepGame}`)).toBe(1);
      expect(await count(tx`select count(*)::int as n from xp_events where player_id = ${f.me}`)).toBe(1);
    }));

  it("deletes nothing for another Player's Module or a bad id", () =>
    withFixture(async (f) => {
      const { tx } = f;
      expect(await deleteModule("someone_else", f.module, tx)).toBe(false);
      expect(await deleteModule(f.me, "not-a-uuid", tx)).toBe(false);
      expect(await deleteModule(f.me, randomUUID(), tx)).toBe(false);
      expect(await count(tx`select count(*)::int as n from modules where id = ${f.module}`)).toBe(1);
      expect(await count(tx`select count(*)::int as n from guess_events where game_id = ${f.game}`)).toBe(1);
    }));

  it("refuses a Module that backs a Course", () =>
    withFixture(async (f) => {
      const { tx } = f;
      await tx`insert into courses (id, slug, title, level, summary, description, module_id)
               values (${randomUUID()}, ${`test-${randomUUID().slice(0, 8)}`}, 'C', 'Beginner', 's', 'd', ${f.module})`;
      expect(await deleteModule(f.me, f.module, tx)).toBe(false);
      expect(await count(tx`select count(*)::int as n from modules where id = ${f.module}`)).toBe(1);
    }));
});
