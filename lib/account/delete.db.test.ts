// Integration test for account deletion (#5). Run with `npm run test:db`.
// Everything happens in a rolled-back transaction.
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { deletePlayerData } from "./delete";

class Rollback extends Error {}

async function inTx(fn: (tx: postgres.TransactionSql) => Promise<void>) {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

/** A Player with one of everything: a Module, file, page, Game, Prompt, Answer, Run, guess, XP, badge, friend. */
async function seedPlayer(tx: postgres.TransactionSql, id: string, friend: string) {
  await tx`insert into players (id) values (${id}), (${friend})`;
  const [{ id: module }] = await tx`insert into modules (player_id, name) values (${id}, 'M') returning id`;
  const [{ id: doc }] = await tx`
    insert into source_documents (module_id, player_id, filename, mime_type, size_bytes, status)
    values (${module}, ${id}, 'notes.pdf', 'application/pdf', 1, 'parsed') returning id`;
  const [{ id: page }] = await tx`
    insert into source_pages (source_document_id, page_index, page_number, content_md)
    values (${doc}, 0, 1, 'secret notes') returning id`;
  const [{ id: game }] = await tx`
    insert into games (module_id, player_id, title, status) values (${module}, ${id}, 'G', 'ready') returning id`;
  await tx`insert into game_sources (game_id, source_document_id) values (${game}, ${doc})`;
  const [{ id: prompt }] = await tx`
    insert into prompts (game_id, source_document_id, kind, text, tier)
    values (${game}, ${doc}, 'cloze', 'Q', 'common') returning id`;
  const [{ id: answer }] = await tx`
    insert into answers (prompt_id, canonical, tier, evidence_page_id) values (${prompt}, 'A', 'common', ${page}) returning id`;
  const [{ id: run }] = await tx`
    insert into runs (player_id, game_id, status) values (${id}, ${game}, 'finished') returning id`;
  await tx`insert into run_prompts (run_id, prompt_id, position, answer_id) values (${run}, ${prompt}, 1, ${answer})`;
  await tx`
    insert into guess_events (player_id, game_id, run_id, prompt_id, position, raw_text, match_method, is_correct, ms_into_prompt)
    values (${id}, ${game}, ${run}, ${prompt}, 1, 'A', 'exact', true, 100)`;
  await tx`insert into xp_events (player_id, amount, reason, ref) values (${id}, 10, 'run_finished', ${run})`;
  await tx`insert into player_badges (player_id, badge_id) values (${id}, 'first-dive')`;
  await tx`insert into friendships (requester, addressee, status) values (${friend}, ${id}, 'accepted')`;
  await tx`insert into rate_limits (key, action, period_s, window_start, hits) values (${id}, 'upload', 60, 0, 1)`;
}

async function rowsFor(tx: postgres.TransactionSql, id: string) {
  const [r] = await tx<Record<string, number>[]>`
    select
      (select count(*) from players where id = ${id})::int as players,
      (select count(*) from modules where player_id = ${id})::int as modules,
      (select count(*) from source_documents where player_id = ${id})::int as documents,
      (select count(*) from source_pages p join source_documents d on d.id = p.source_document_id where d.player_id = ${id})::int as pages,
      (select count(*) from games where player_id = ${id})::int as games,
      (select count(*) from runs where player_id = ${id})::int as runs,
      (select count(*) from guess_events where player_id = ${id})::int as guesses,
      (select count(*) from xp_events where player_id = ${id})::int as xp,
      (select count(*) from player_badges where player_id = ${id})::int as badges,
      (select count(*) from friendships where requester = ${id} or addressee = ${id})::int as friendships,
      (select count(*) from rate_limits where key = ${id})::int as rate_limits`;
  return r;
}

describe("deletePlayerData", () => {
  it("removes every row of the Player's data and leaves other Players alone", () =>
    inTx(async (tx) => {
      const me = `test_delete_${randomUUID()}`;
      const friend = `test_delete_friend_${randomUUID()}`;
      await seedPlayer(tx, me, friend);
      expect(Object.values(await rowsFor(tx, me)).every((n) => n > 0)).toBe(true);

      await deletePlayerData(me, tx);
      await tx`set constraints all immediate`; // the deferred FKs a real commit would check

      expect(Object.values(await rowsFor(tx, me)).every((n) => n === 0)).toBe(true);
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from players where id = ${friend}`;
      expect(n).toBe(1);
      await deletePlayerData(me, tx); // idempotent
    }));

  it("refuses the system Player", async () => {
    await expect(deletePlayerData("system")).rejects.toThrow(/Refusing/);
  });
});
