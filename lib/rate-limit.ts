import "server-only";
import type postgres from "postgres";
import { sql } from "./db";

// Rate limits on the routes that spend AI money (#5). Fixed windows in the `rate_limits` table:
// a per-Player burst limit, a per-Player daily cap, and (for the AI calls) a site-wide daily cap
// that bounds the bill even if someone signs up many accounts. Denied requests don't count.
//
//   const limit = await rateLimit(playerId, "generate");
//   if (!limit.ok) return rateLimitedResponse(limit);

export type RateLimitedAction = "upload" | "generate" | "sonar" | "notes";

export type Rule = { scope: "player" | "site"; periodS: number; max: number };

const MINUTE = 60;
const DAY = 24 * 60 * 60;

/** Tune here. Daily windows reset at 00:00 UTC. */
export const LIMITS: Record<RateLimitedAction, Rule[]> = {
  upload: [
    { scope: "player", periodS: MINUTE, max: 10 },
    { scope: "player", periodS: DAY, max: 100 },
  ],
  generate: [
    { scope: "player", periodS: MINUTE, max: 3 },
    { scope: "player", periodS: DAY, max: 25 },
    { scope: "site", periodS: DAY, max: 1000 },
  ],
  sonar: [
    { scope: "player", periodS: MINUTE, max: 10 },
    { scope: "player", periodS: DAY, max: 150 },
    { scope: "site", periodS: DAY, max: 5000 },
  ],
  notes: [
    { scope: "player", periodS: MINUTE, max: 20 },
    { scope: "player", periodS: DAY, max: 300 },
    { scope: "site", periodS: DAY, max: 5000 },
  ],
};

const NOUN: Record<RateLimitedAction, string> = {
  upload: "uploads",
  generate: "new Games",
  sonar: "messages to Sonar",
  notes: "study notes",
};

/** The `rate_limits.key` for the site-wide cap. Never a Clerk user id. */
export const SITE_KEY = "*";

export type Counter = { key: string; periodS: number; windowStart: number; hits: number };
export type Decision = { ok: true } | { ok: false; retryAfter: number; error: string };

/** Whether one more request fits under every rule, given the stored counters. Pure. */
export function decide(action: RateLimitedAction, playerId: string, counters: Counter[], nowS: number): Decision {
  let worst: { rule: Rule; retryAfter: number } | null = null;
  for (const rule of LIMITS[action]) {
    const key = rule.scope === "site" ? SITE_KEY : playerId;
    const windowStart = windowOf(rule.periodS, nowS);
    const c = counters.find((x) => x.key === key && x.periodS === rule.periodS);
    const hits = c && c.windowStart === windowStart ? c.hits : 0;
    if (hits < rule.max) continue;
    const retryAfter = Math.max(1, Math.ceil(windowStart + rule.periodS - nowS));
    if (!worst || retryAfter > worst.retryAfter) worst = { rule, retryAfter };
  }
  return worst ? { ok: false, retryAfter: worst.retryAfter, error: message(action, worst.rule, worst.retryAfter) } : { ok: true };
}

export const windowOf = (periodS: number, nowS: number) => Math.floor(nowS / periodS) * periodS;

function message(action: RateLimitedAction, rule: Rule, retryAfter: number): string {
  const noun = NOUN[action];
  if (rule.scope === "site") return `Syllabyss has reached today's limit for ${noun}. Try again tomorrow.`;
  if (rule.periodS <= MINUTE) return `Too many ${noun} in a row. Try again in ${retryAfter} seconds.`;
  const hours = Math.ceil(retryAfter / 3600);
  return `You've reached today's limit of ${rule.max} ${noun}. Try again in ${hours === 1 ? "an hour" : `${hours} hours`}.`;
}

type Db = postgres.Sql | postgres.TransactionSql;

/**
 * Counts one request for `action` if it fits under every limit. `db` lets tests pass a
 * transaction; otherwise this opens its own. Serialised per Player and action with an advisory
 * lock, so concurrent requests can't both take the last slot.
 */
export async function rateLimit(
  playerId: string,
  action: RateLimitedAction,
  opts: { db?: Db; nowS?: number } = {},
): Promise<Decision> {
  const nowS = opts.nowS ?? Date.now() / 1000;
  const run = (tx: Db) => checkAndCount(tx, playerId, action, nowS);
  return opts.db ? run(opts.db) : sql.begin(run);
}

async function checkAndCount(tx: Db, playerId: string, action: RateLimitedAction, nowS: number): Promise<Decision> {
  await tx`select pg_advisory_xact_lock(hashtext(${`rate:${playerId}:${action}`}))`;
  const rows = await tx<{ key: string; period_s: number; window_start: string; hits: number }[]>`
    select key, period_s, window_start, hits from rate_limits
    where key in (${playerId}, ${SITE_KEY}) and action = ${action}`;
  const counters = rows.map((r) => ({ key: r.key, periodS: r.period_s, windowStart: Number(r.window_start), hits: r.hits }));
  const decision = decide(action, playerId, counters, nowS);
  if (!decision.ok) return decision;

  const values = LIMITS[action].map((rule) => ({
    key: rule.scope === "site" ? SITE_KEY : playerId,
    action,
    period_s: rule.periodS,
    window_start: windowOf(rule.periodS, nowS),
    hits: 1,
  }));
  await tx`
    insert into rate_limits ${tx(values)}
    on conflict (key, action, period_s) do update set
      hits = case when rate_limits.window_start = excluded.window_start then rate_limits.hits + 1 else 1 end,
      window_start = excluded.window_start`;
  return decision;
}

/** 429 with the user-facing reason in the API's `{ error }` shape. */
export function rateLimitedResponse(d: Extract<Decision, { ok: false }>): Response {
  return Response.json({ error: d.error }, { status: 429, headers: { "Retry-After": String(d.retryAfter) } });
}
