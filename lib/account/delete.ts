import "server-only";
import type postgres from "postgres";
import { sql } from "@/lib/db";

// Account deletion (#5): erase every row of a Player's data. Called by DELETE /api/me/account
// (the Player deletes themselves) and by the Clerk `user.deleted` webhook (deleted from Clerk's side).

/** Hypertables keyed by player_id with no FK to players (hypertables can't cascade). */
const PLAYER_HYPERTABLES = ["guess_events", "xp_events", "daily_results", "daily_answer_finds"] as const;

/** Continuous aggregates with a player_id column, rebuilt after a delete so no per-Player rows linger. */
const PLAYER_AGGREGATES = ["player_game_daily", "player_activity_daily", "player_xp_weekly"] as const;

type Db = postgres.Sql | postgres.TransactionSql;

/**
 * Deletes the Player row (cascading to Modules, Source Documents and their pages, Games, Runs,
 * badges, friendships and Topic progress), their hypertable rows and their rate-limit counters.
 * Idempotent. `db` lets tests pass a transaction; otherwise this opens its own.
 */
export async function deletePlayerData(playerId: string, db?: Db): Promise<void> {
  if (!playerId || playerId === "system") throw new Error(`Refusing to delete Player "${playerId}"`);
  const run = async (tx: Db) => {
    for (const table of PLAYER_HYPERTABLES) await tx`delete from ${tx(table)} where player_id = ${playerId}`;
    await tx`delete from rate_limits where key = ${playerId}`;
    await tx`delete from players where id = ${playerId}`;
  };
  await (db ? run(db) : sql.begin(run));
}

/**
 * Re-materialises the per-Player continuous aggregates over the invalidated ranges, so a deleted
 * Player's rows drop out of them too. Can't run inside a transaction. Only touches invalidated
 * buckets, so it's cheap.
 */
export async function refreshPlayerAggregates(): Promise<void> {
  for (const view of PLAYER_AGGREGATES) await sql`call refresh_continuous_aggregate(${view}::regclass, null, null)`;
}
