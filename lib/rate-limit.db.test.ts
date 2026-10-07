// Integration test for the rate_limits counters (#5). Run with `npm run test:db`.
// Everything happens in a rolled-back transaction.
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import { LIMITS, rateLimit } from "./rate-limit";

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

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0) / 1000;

describe("rateLimit", () => {
  it("counts up to the burst limit, then refuses without counting, then resets next minute", () =>
    inTx(async (tx) => {
      const me = `test_rate_${randomUUID()}`;
      const burst = LIMITS.generate[0].max;
      for (let i = 0; i < burst; i++) expect((await rateLimit(me, "generate", { db: tx, nowS: NOW + i })).ok).toBe(true);
      expect(await rateLimit(me, "generate", { db: tx, nowS: NOW + 10 })).toMatchObject({ ok: false, retryAfter: 50 });

      const [day] = await tx<{ hits: number }[]>`
        select hits from rate_limits where key = ${me} and action = 'generate' and period_s = 86400`;
      expect(day.hits).toBe(burst); // the refused request didn't count

      expect((await rateLimit(me, "generate", { db: tx, nowS: NOW + 60 })).ok).toBe(true);
      const [minute] = await tx<{ hits: number }[]>`
        select hits from rate_limits where key = ${me} and action = 'generate' and period_s = 60`;
      expect(minute.hits).toBe(1);
    }));

  it("keeps actions separate", () =>
    inTx(async (tx) => {
      const me = `test_rate_${randomUUID()}`;
      for (let i = 0; i < LIMITS.generate[0].max; i++) await rateLimit(me, "generate", { db: tx, nowS: NOW });
      expect((await rateLimit(me, "upload", { db: tx, nowS: NOW })).ok).toBe(true);
    }));
});
