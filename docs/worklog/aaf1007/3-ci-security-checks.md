# #3 CI: CodeQL, dependency review, Docker build check, actionlint

Status: in-review
Branch: feat/3-ci-security-checks
Updated: 2026-10-05

## Goal
Follow-up to #1: security and build checks on top of CI. Docs: `docs/deploy.md` §7.

## Done so far
- `.github/workflows/codeql.yml`: CodeQL advanced setup, `security-extended`, matrix `javascript-typescript` + `actions`, build-mode none; PRs, main, weekly (Mon 09:17 UTC).
- `ci.yml` jobs: `docker` (buildx build of the Dockerfile, no push, GHA cache), `actionlint` (v1.7.7 + preinstalled shellcheck), `dependency-review` (PRs only, fail on high).
- actionlint clean locally.
- `deploy.yml`: smoke job gets `if: always() && needs.deploy.result == 'success'`. The first real Deploy (after #2) skipped it because migrate was skipped and skips cascade.

## Next steps
1. User review, then PR; its run is the first run of all four.
2. After merge: optionally add the new checks to the `main` ruleset's required status checks.
3. At PR time: FEATURES.md entry, worklog done.

## Decisions & gotchas
- CodeQL Default setup must stay off (it was `not-configured` on 2026-10-05); advanced workflow and default setup conflict.
- Dependency review needs the dependency graph, on by default for public repos.
- Docker build needs no build args: `next build` works without env (verified in #1).

## Files touched
- .github/workflows/codeql.yml, .github/workflows/ci.yml, .github/workflows/deploy.yml, docs/deploy.md, CLAUDE.md, this worklog
