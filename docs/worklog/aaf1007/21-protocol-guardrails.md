# #21 Team-sync and PR-protocol guardrails

Status: done
Branch: chore/21-protocol-guardrails
Updated: 2026-10-09

## Goal
From a retro on #19: the sync offered finished worklogs for resume, and a chore skipped the protocol because it only described features. Fix the sync, make the protocol cover every fix, feature and chore, and check PRs in CI.

## Done so far
- Issue claimed; label `no-feature-row` created.
- `scripts/agent-sync.sh`: fetch `--prune`; worklogs read from `origin/main` plus unmerged refs; done on any ref hides it. Tested with a fake stale branch; sync went from ~6.4s to ~4.1s.
- `12-deploy-prep.md` and `overnight-decisions.md` set to done.
- `coordination.md` §2/§4, `AGENTS.md` steps 2 and 5, worklog README template: protocol covers fixes, features and chores; `<type>/<n>-<slug>`.
- `scripts/check-pr-protocol.sh` + `.github/workflows/pr-protocol.yml`. Replayed on merged PRs: #16 and #18 pass, #20 fails (branch name; and no worklog even with the label). actionlint and shellcheck clean.

## Next steps
1. Done: user approved; PR opened with `Closes #21` and the `no-feature-row` label.
2. Optional, user's call: make "Branch, issue, worklog, FEATURES" a required check in the `main` branch protection.

## Decisions & gotchas
- Chores skip the FEATURES board with the `no-feature-row` label (user's call). This PR uses it.
- The check is its own workflow so label edits don't re-run the build and DB tests in `ci.yml`.
- The working tree had uncommitted graft changes (`AGENTS.md` graft block, `.claude/settings.json`, `.gitignore`, `.mcp.json`, `.claude/skills/`); they are the user's and stay out of these commits.
- F12's board row still says in-progress; left alone (not this issue's row).

## Files touched
- `scripts/agent-sync.sh`, `scripts/check-pr-protocol.sh`, `.github/workflows/pr-protocol.yml`
- `AGENTS.md`, `docs/agents/coordination.md`, `docs/worklog/README.md`
- `docs/worklog/aaf1007/12-deploy-prep.md`, `docs/worklog/aaf1007/overnight-decisions.md`
