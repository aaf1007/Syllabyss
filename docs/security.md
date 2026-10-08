# Security and going live

What protects syllabyss.tech and its users, and the steps only a human can do (dashboards, DNS, approvals). Issue #5.

## Why a work laptop says the site "isn't secure"

The site's HTTPS is fine (TLS 1.3, a Google Trust Services certificate that renews automatically, HTTP → HTTPS redirect). The warning comes from corporate web filters (Zscaler, Netskope, Palo Alto, Cisco Umbrella…), which flag any domain registered in the last ~30 days. syllabyss.tech was registered on **2026-10-04**. `.tech` domains also start with a lower reputation.

Also check the address: it's syllabyss.tech. syllabus.tech belongs to someone else.

## What the code does

| Protection | Where | Notes |
|---|---|---|
| Security headers on every response: HSTS (2 years, subdomains), `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP; no `x-powered-by` | `lib/security/headers.ts`, `next.config.ts` | Built at **build time**: the Clerk host in the CSP comes from the build's `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| Content-Security-Policy, **Report-Only** for now | same, `CSP_ENFORCE` | Violations are POSTed to `/api/csp-report` and logged as `[csp] {…}` lines |
| Rate limits on the routes that spend AI money: uploads, Game generation, Sonar, page notes | `lib/rate-limit.ts` (`LIMITS`), table `rate_limits` | Per Player per minute and per UTC day, plus a site-wide daily cap that bounds the bill even with many accounts. 429 + `Retry-After` + `{ error }` |
| Account deletion | `/settings`, `DELETE /api/me/account`, `lib/account/delete.ts` | Deletes every row of the Player's data, then the Clerk user |
| Clerk `user.deleted` webhook | `/api/webhooks/clerk` | Deletes the data when a user is removed from Clerk's side too |
| Privacy Policy, Terms | `/privacy`, `/terms` | Linked from the footer, sign-up and Settings |
| Auth on every route, Player-scoped queries, no AI during Runs | `lib/auth.ts` | Already in place, see `docs/architecture/overview.md` |

If you add a third-party script, image, font or API host to the frontend, add it to the CSP in `lib/security/headers.ts`. If you send user data to a new service, add it to `/privacy` in the same PR.

## Manual steps (needs human)

Do them roughly in this order. Tick them off in issue #5.

### 1. Ship the code

- [ ] Review and merge the `feat/5-security-hardening` PR.
- [ ] Approve the production migration `20261006T2330_rate_limits.sql` when the Deploy run asks (`docs/deploy.md` §7). The deploy waits for it, so the rate-limited routes never run without their table.
- [ ] After it's live: `curl -sI https://syllabyss.tech/ | grep -iE "strict-transport|content-security|x-frame"` shows the new headers.

### 2. Clerk (dashboard.clerk.com, the **production** instance)

- [ ] **Webhooks → Add endpoint**: URL `https://syllabyss.tech/api/webhooks/clerk`, subscribe to **`user.deleted`** only. Copy its **Signing Secret** (`whsec_…`).
- [ ] **Render → syllabyss → Environment**: add `CLERK_WEBHOOK_SIGNING_SECRET` = that secret, then redeploy. Test with the endpoint's **Testing** tab (send `user.deleted`): Render's log should show no `[clerk-webhook] verification failed` line.
- [ ] **Configure → Attack protection**: turn on **Bot sign-up protection** (Cloudflare Turnstile; the CSP already allows it) and **Brute-force / lockout** if it's off.
- [ ] **Configure → Password**: turn on **Reject compromised passwords** (if you allow passwords at all; email codes + Google are safer).
- [ ] **Configure → Restrictions**: consider **Block email subaddresses** and **Block disposable email domains**. These slow down people making many accounts to get past the per-Player limits.
- [ ] Optional, **User & authentication → Multi-factor**: allow authenticator apps.

### 3. Render (dashboard.render.com → the web service)

- [ ] **Environment**: `DEV_PLAYER_ID` is **not** set. `SONAR_MODEL` is unset or starts with `claude-`.
- [ ] **LangSmith** (smith.langchain.com), if `LANGSMITH_TRACING=true`: `/privacy` says Sonar traces are deleted after **14 days**, so keep the `syllabyss-sonar` project on **base** trace retention (14 days) and don't upgrade traces to extended (400-day) retention, including through automation rules or annotation queues, which upgrade the traces they touch. Only give teammates who need it access to the LangSmith workspace: traces contain Players' messages.
- [ ] **Environment**: change `DATABASE_URL` from `sslmode=require` to **`sslmode=verify-full`**. Also update it in the GitHub environments `production` and `production-db`. Tiger Cloud's certificate chains to a public CA (checked on the dev service), so nothing else is needed. This stops a network attacker from impersonating the database.
- [ ] **Notifications**: send deploy failures to your email.

### 4. AI providers

- [ ] **Google AI Studio / Cloud billing**: the production `GEMINI_API_KEY` is on a **paid** (billing-enabled) project. On the free tier Google may use prompts (your users' notes) to improve its products, which contradicts `/privacy`.
- [ ] **Google Cloud → Billing → Budgets & alerts**: a monthly budget with email alerts (e.g. 50%, 90%, 100%).
- [ ] **console.anthropic.com → Limits**: set a monthly **spend limit** for the production key.
- [ ] Optional: restrict each key (Gemini: API restrictions to the Generative Language API only).

### 5. Tiger Cloud (console.cloud.timescale.com)

- [ ] Production uses its **own** service, not the shared `stormhacks-dev` (`docs/deploy.md` §3). The DB tests and every teammate's `.env.local` write to the dev one.
- [ ] Check the production service's **backups / point-in-time recovery** are on, and note the retention period. Account deletion says backups "expire on their normal schedule".
- [ ] Rotate the production DB password if it has ever been pasted into chat, a doc, or a teammate's `.env.local`, then update Render and the two GitHub environments.
- [ ] Optional: **IP allow list**. Render's outbound IPs are on the service's **Connect → Outbound** page; add them plus GitHub Actions'. GitHub's runners use many IPs, so this needs a self-hosted runner or a fixed-IP proxy to keep `deploy.yml` working; skip it unless you need it.

### 6. Domain reputation (the "not secure" warning)

- [ ] Submit syllabyss.tech for categorisation (**Education**) to the big web-filter vendors. Each is a free form, usually reviewed in 1–3 days:
  - Zscaler: https://sitereview.zscaler.com
  - Palo Alto Networks: https://urlfiltering.paloaltonetworks.com
  - Cisco Talos / Umbrella: https://talosintelligence.com/reputation_center
  - Fortinet: https://www.fortiguard.com/webfilter
  - Broadcom (Symantec / Blue Coat): https://sitereview.bluecoat.com
  - Netskope: only its customers can request a recategorisation, so ask your IT team if your laptop uses it
- [ ] Check https://transparencyreport.google.com/safe-browsing/search?url=syllabyss.tech says "No unsafe content found".
- [ ] If it's still flagged on your work laptop after the vendor accepts it, ask your IT team to allow-list it. The "newly registered" flag lifts on its own after ~30 days.

### 7. DNS and privacy@ email (done 2026-10-08)

DNS is managed at get.tech (manage.get.tech → syllabyss.tech → DNS → DNS Records; Namify is the registrar). Mail to **privacy@syllabyss.tech** (given in `/privacy` and `/terms`) is forwarded by **ImprovMX**. Records now in place:

| Type | Host | Value | Why |
|---|---|---|---|
| A | `@` | Render's IP | The site |
| CNAME | `clerk`, `accounts`, `clkmail`, `clk._domainkey`, `clk2._domainkey` | Clerk's | Sign-in and Clerk's emails. Don't touch |
| MX | `@` | `mx1.improvmx.com` (10), `mx2.improvmx.com` (20) | privacy@ forwarding |
| TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` | Only ImprovMX may send as the bare domain. Clerk's emails go out via `clkmail.syllabyss.tech`, which has its own records |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r` | Mail faking `@syllabyss.tech` goes to spam. Clerk's emails still pass, through their DKIM (`clk._domainkey`) |

- There is **one** SPF record. If you add another mail sender (e.g. replying from privacy@ through Gmail), add its `include:` to that record; never add a second `v=spf1` record.
- No CAA records: the get.tech DNS manager doesn't offer the type.
- [ ] Turn on **Auto-Renew** (get.tech → Overview). The domain expires 2027-10-04.
- [ ] Optional: once HSTS has been live a few weeks with no problems, add `; preload` to the HSTS header in `lib/security/headers.ts` and submit at https://hstspreload.org. It's hard to undo, so only do it once you're sure every subdomain will stay HTTPS.

### 8. Turn the CSP on (about a week after step 1)

- [ ] In Render → Logs, search for `[csp]`. Ignore violations from browser extensions: a `blocked` URL like `fonts.gstatic.com` or `chrome-extension://` that none of our code loads. In testing, a font extension in one browser produced Google Fonts reports that a clean browser didn't.
- [ ] For any real violation (our own page loading something), add the host to `lib/security/headers.ts`.
- [ ] When it's quiet, set `CSP_ENFORCE = true`, ship it, and click through sign-in, a Module upload, each Game Mode and Sonar on the live site.

### 9. GitHub

- [x] **Security → Dependabot**: alert #2 (`sprintf-js`, moderate) comes from `mammoth` → `argparse`, which only mammoth's command-line tool uses; our code calls the library API. There's no patched version and `npm audit fix --force` downgrades mammoth by years. Dismiss it as "Vulnerable code is not actually used".
- [x] **Settings → Code security**: turn on **Secret scanning** and **Push protection** (free for public repos), so a pasted API key is blocked at push time.
- [ ] Settings → Collaborators: remove anyone who no longer needs write access.

### 10. Before inviting lots of users (later)

- Have someone who knows the relevant law read `/privacy` and `/terms`. They were written to match how the code handles data, but they're not legal advice. If you have users in BC, check BC PIPA; in the EU, the GDPR.
- Consider a "Download my data" export in Settings. `/privacy` currently says to email for a copy.
- Add an uptime monitor (e.g. Better Stack or UptimeRobot, free) on `https://syllabyss.tech/` so you hear about outages before users do.
