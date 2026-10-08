import "server-only";
import { sql } from "@/lib/db";
import { isUuid } from "@/lib/documents/queries";
import type { Db } from "@/lib/progress";

/**
 * Deletes the Player's Module. Foreign keys cascade to its Source Documents, pages, Games,
 * Prompts and Runs; guess_events (a hypertable with no foreign keys) go by hand, like a Game
 * delete. XP, streaks and badges already earned stay. A Module that backs a Course is never
 * deleted. One statement, so it's all or nothing. Returns false when nothing was deleted.
 */
export async function deleteModule(playerId: string, moduleId: string, db: Db = sql): Promise<boolean> {
  if (!isUuid(moduleId)) return false;
  const [{ n }] = await db<{ n: number }[]>`
    with target as (
      select m.id from modules m
      where m.id = ${moduleId} and m.player_id = ${playerId}
        and not exists (select 1 from courses c where c.module_id = m.id)
    ), guesses as (
      delete from guess_events
      where player_id = ${playerId}
        and game_id in (select g.id from games g join target t on g.module_id = t.id)
    ), gone as (
      delete from modules where id in (select id from target) returning id
    )
    select count(*)::int as n from gone`;
  return n > 0;
}
