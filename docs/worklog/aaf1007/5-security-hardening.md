# #5 Security hardening for real users

Status: in-progress
Branch: feat/5-security-hardening
Updated: 2026-10-06 23:30

## Goal
Make syllabyss.tech safe to open to real users: security headers + CSP, rate limits on the AI routes,
privacy/terms pages, account deletion, and a checklist of the manual (dashboard/DNS) steps in docs/security.md.

## Done so far
- Diagnosis: TLS is fine (TLS 1.3, Google Trust Services cert, HTTP→HTTPS). The work-laptop warning is the
  domain's age (registered 2026-10-04) tripping corporate "newly registered domain" filters.
- Headers: `lib/security/headers.ts` (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy,
  COOP, CSP **Report-Only**), wired in `next.config.ts`; `poweredByHeader: false`. Reports → `POST /api/csp-report` → `[csp]` log lines.
- Rate limits: migration `20261006T2330_rate_limits.sql`, `lib/rate-limit.ts` (`rateLimit`, `rateLimitedResponse`, `LIMITS`),
  applied to upload, Game generation, Sonar chat, page notes (fresh Gemini calls only). 429 + Retry-After + `{ error }`.
- Account deletion: `lib/account/delete.ts` (`deletePlayerData`, `refreshPlayerAggregates`), `DELETE /api/me/account`
  (typed confirm phrase, then Clerk deleteUser), Clerk webhook `POST /api/webhooks/clerk` (user.deleted), `/settings` page.
- `/privacy`, `/terms` (components/site/LegalPage.tsx), linked from footer, sign-up, Settings; Settings in user menu + mobile nav.
- Tests: headers, csp-report, rate-limit (unit); rate-limit + account delete (db), run against a local
  timescale/timescaledb-ha:pg17 container, not the shared DB.

## Next steps
1. docs/security.md: manual checklist (domain reputation, DNS CAA/SPF/DMARC, Clerk, Render env, Tiger backups, CSP enforce).
2. Run the app locally, check headers + CSP report-only console for violations on /, sign-in, a Mode screen.
3. `npm run build`; hand to the user for review. No PR until approved.

## Decisions & gotchas
- CSP is built at **build time** (next.config headers), so the Clerk host comes from the Docker build arg
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Flip `CSP_ENFORCE` in lib/security/headers.ts once prod logs are clean.
- No nonces: they'd force every page dynamic. 'unsafe-inline' scripts stay; the CSP still blocks foreign origins, framing, plugins.
- Rate limits: denied requests don't count; advisory lock per Player+action; site-wide '*' key caps the daily AI bill.
- Account delete: hypertables (guess_events, xp_events, daily_results, daily_answer_finds) have no FK, deleted explicitly;
  the rest cascades from players. Continuous aggregates are refreshed after (outside a tx).
- `lib/daily/daily.test.ts` "reads NEXT_PUBLIC_SITE_URL" fails locally when .env.local sets it; same on main, unrelated.

## Files touched
- next.config.ts, lib/security/*, app/api/csp-report, lib/rate-limit*.ts, db/migrations/20261006T2330_rate_limits.sql
- the four AI routes, components/sonar/SonarBuddy.tsx
- lib/account/*, app/api/me/account, app/api/webhooks/clerk, app/settings/*
- app/privacy, app/terms, components/site/{LegalPage,SiteFooter,SiteNav,UserMenu}.tsx, app/sign-up
