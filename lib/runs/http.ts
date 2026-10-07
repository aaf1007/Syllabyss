import "server-only";
import type postgres from "postgres";
import { getApiPlayer } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getGuest } from "@/lib/guest";
import { RunError } from "./run-engine";

// Shared wrapper for the Run route handlers: auth, one transaction, the server's clock,
// and RunError → HTTP status. Anything else is a 500. `guests: true` also lets this browser's
// Guest act on its own Runs (#8); Guests only ever have Daily Dive Runs, so starting a Run of
// any other Game stays Player-only.
export async function runRoute<T>(
  fn: (tx: postgres.TransactionSql, playerId: string, now: Date) => Promise<T>,
  opts: { guests?: boolean } = {},
): Promise<Response> {
  const playerId = (await getApiPlayer()) ?? (opts.guests ? await getGuest() : null);
  if (!playerId) return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const now = new Date();
    const result = await sql.begin((tx) => fn(tx, playerId, now));
    return Response.json(result);
  } catch (e) {
    if (e instanceof RunError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
