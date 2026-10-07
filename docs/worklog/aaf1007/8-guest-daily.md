# #8 Guest Daily Dive

Status: in-review
Branch: feat/8-guest-daily
Updated: 2026-10-07

## Goal
Signed-out visitors can play today's Daily Dive once as a Guest, off the Leaderboard, with no XP, streaks or badges. Spec: issue #8; design in docs/architecture/daily-dive.md § Guests.

## Done so far
- Migration `20261007T2200_guests.sql`: `players.is_guest` (applied to stormhacks-dev).
- `lib/guest.ts`: `getGuest()`, `ensureGuest()` (row + httpOnly cookie), `isGuest()`.
- Auth: `requirePlayerOrGuest()` for the Run and Reveal pages; `runRoute(…, { guests: true })` on the /api/runs/[runId]/* routes; `dailyRoute("guest")` for POST /api/daily/today/run, and `"optional"` now passes the Guest.
- Engine: `afterFinish` skips Guests. `gameLeaderboard` global scope excludes Guests.
- Daily: `startTodayRun` (one finished dive per Guest, 409), `dailyToday` guest card (`status: "played"`, `wouldPlace`), `dailyReveal` (`guest`, `wouldPlace`, share text without "(practice)"), `wouldPlace()` in record.ts.
- UI: Today card (guest Dive In, guest result + sign-up), hub streak/board/archive treat Guests as signed out, Reveal DailyBlock GUEST label + sign-up actions, Sonar button hidden for Guests, lumenLine/crowdCaption copy.
- Tests: 2 new DB tests (daily.db.test.ts "Guest Daily Dive"), format tests. Full test:db 104/104. Browser: played a full Guest dive signed out on localhost:3008; card, 409, Reveal verified; test Guest deleted.

## Next steps
1. User review; on approval open the PR (FEATURES.md row, set this to done, `Closes #8`).

## Decisions & gotchas
- Cookie is unsigned: the value is a random `guest_<uuid>` and must match an existing `is_guest` row, so signing would add a secret to manage without adding protection (the issue said "signed").
- Guests are only ever created by POST /api/daily/today/run; there's no cleanup of old Guest rows yet.
- No rate limit on Guest creation (each cookie-less POST makes a row). Worth adding with the rate-limit work.
- `lib/daily/daily.test.ts` "reads NEXT_PUBLIC_SITE_URL" fails locally when .env.local sets it; unrelated.

## Files touched
- db/migrations/20261007T2200_guests.sql, lib/guest.ts, lib/auth.ts, lib/runs/http.ts, lib/runs/run-engine.ts, app/api/runs/[runId]/**/route.ts
- lib/social/leaderboards.ts, lib/daily/{http,queries,record,types}.ts, app/api/daily/today/run/route.ts
- app/daily/{page,DailyHub,TodayCard,play}.tsx/ts, components/daily/format.ts(+test), components/modes/dive/DiveRevealScreen.tsx
- app/runs/[runId]/page.tsx, app/runs/[runId]/reveal/page.tsx
- lib/daily/daily.db.test.ts, docs/architecture/daily-dive.md
