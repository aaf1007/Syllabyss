<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Discuss before you build

When asked to fix a bug or add a feature, your first deliverable is a proposal, not code, however small the change. Read enough to understand the problem, talk the approach through with the user, and wait for their explicit go before editing any file. A go covers that proposal; if the approach changes mid-way, propose again.

- **Bug:** the root cause with evidence (file:line, repro steps), the proposed fix, and alternatives. If the cause is unclear, diagnose first: reproduce the bug and pin down the cause before proposing a fix.
- **Feature:** the approach, the files and shared contracts it touches, and the open decisions. Ask the user about each decision that is theirs: behaviour, UX, scope, trade-offs.
- Match the planning to the open question, using your planning skills where you have them: grill the user on a design with several unresolved choices, prototype a UI or state model they need to see, design the module interface when a seam moves, and use plan mode (or a written plan) for multi-file work.

# Team coordination (read every session, follow without being asked)

Several people with different agents build this repo in parallel. Full protocol: `docs/agents/coordination.md`. In short:

1. **Session start:** run `bash scripts/agent-sync.sh` (Claude Code runs it automatically). If the branch is behind `origin/main`, tell the user what merged.
2. **After the user's go on any fix, feature or chore:** find or create its GitHub issue. If someone else has claimed it (label `in-progress` and an assignee), stop and tell the user. Otherwise claim it (`gh issue edit <n> --add-assignee @me --add-label in-progress`) and branch `<type>/<n>-<slug>` (`feat`, `fix`, `chore` or `refact`) from `origin/main`.
3. **Worklog:** keep resumable notes in `docs/worklog/<github-login>/<issue#>-<slug>.md` (template in `docs/worklog/README.md`). Create it when you claim, update it after each chunk and before the session ends, and commit it with the code. At session start, offer to resume any unfinished worklog the sync lists.
4. **Changing a shared contract** (DB schema, `lib/` signatures, API routes, `CONTEXT.md` terms): comment on your issue first.
5. **No PRs until the user approves.** Never open a PR (not even a draft) on your own. When the work is done, hand it to the user for review. Only after they explicitly say it's good, open the PR. In that PR: in `docs/FEATURES.md`, tick your feature's checklist, set Status `done`, and fill Entry points and Notes for others (a chore with no board row gets the `no-feature-row` PR label instead), set your worklog to `Status: done`, and include `Closes #<n>` in the PR body.

**No AI attribution.** Never add `Co-Authored-By:` trailers for Claude, Codex or any other agent, nor "Generated with …" lines, to commits, PR titles or PR bodies. Only the humans on the team are contributors.

Before working, read `CONTEXT.md` (vocabulary) and `docs/architecture/overview.md` (system design).
