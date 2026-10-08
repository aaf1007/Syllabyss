# #17 Random pixel avatar for new Players

Status: done
Branch: feat/17-random-avatar
Updated: 2026-10-08 14:10

## Goal
New Players all got the `anglerfish` avatar (the `players.avatar` column default). Give each new Player a random one instead.

## Done so far
- `randomAvatar()` in `lib/social/types.ts` picks from `AVATARS`.
- The three places that first insert a `players` row pass it: `lib/auth.ts` ensurePlayer, `lib/social/profile.ts` ensureProfile, `lib/guest.ts` ensureGuest.
- Unit test in `components/site/avatar-ids.test.ts`; DB test in `lib/social/social.db.test.ts` (new Players get varied valid avatars, existing ones are untouched).

## Next steps
1. None. Reviewed and opened as a PR.

## Decisions & gotchas
- Chosen in app code, not as a DB default: `AVATARS` says adding an avatar needs no migration, and a SQL default would have to repeat the list.
- Only on insert (`on conflict do nothing`), so existing Players keep whatever they have. No backfill: we can't tell who picked `anglerfish` on purpose.
- The column default stays `'anglerfish'` for rows inserted elsewhere (tests, the system Player).
- `lib/daily/daily.test.ts` "reads NEXT_PUBLIC_SITE_URL" fails locally on main too when `.env.local` sets that var; unrelated.

## Files touched
- lib/social/types.ts, lib/auth.ts, lib/guest.ts, lib/social/profile.ts
- components/site/avatar-ids.test.ts, lib/social/social.db.test.ts
