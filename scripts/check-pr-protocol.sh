#!/usr/bin/env bash
# Checks a PR against the coordination protocol (docs/agents/coordination.md §2 and §4):
# branch <type>/<n>-<slug>, "Closes #<n>" in the body, the worklog for <n> at Status: done,
# and a docs/FEATURES.md row for #<n> (a chore with no board row is labelled no-feature-row).
# Run by .github/workflows/pr-protocol.yml. Locally, before opening a PR:
#   BODY="Closes #<n>" bash scripts/check-pr-protocol.sh
# Env: BODY, BRANCH (default: current branch), NO_FEATURE_ROW=true to skip the FEATURES check,
# BASE (default origin/main), HEAD_REF (default HEAD).

set -u
branch=${BRANCH:-$(git branch --show-current)}
base=${BASE:-origin/main}
head=${HEAD_REF:-HEAD}
fail=0
err() { echo "::error::$1"; fail=1; }

n=$(printf '%s' "$branch" | sed -nE 's#^(feat|fix|chore|refact)/([0-9]+)-.+#\2#p')
if [ -z "$n" ]; then
  err "Branch '$branch' must be <type>/<issue#>-<slug>, with type feat, fix, chore or refact (coordination.md §2)."
  exit 1
fi

printf '%s' "${BODY:-}" | grep -qiE "(close[sd]?|fix(e[sd])?|resolve[sd]?) #$n([^0-9]|$)" \
  || err "The PR body must include 'Closes #$n'."

if ! changed=$(git diff --name-only "$base...$head"); then
  err "Could not diff $base...$head."
  exit 1
fi

worklog=$(printf '%s\n' "$changed" | grep -E "^docs/worklog/[^/]+/$n-[^/]+\.md$" | head -1)
if [ -z "$worklog" ]; then
  err "The PR must update the worklog docs/worklog/<login>/$n-<slug>.md (docs/worklog/README.md)."
elif ! git show "$head:$worklog" 2>/dev/null | grep -qE '^Status: *done'; then
  err "$worklog must say 'Status: done' before the PR (coordination.md §4)."
fi

if [ "${NO_FEATURE_ROW:-false}" != "true" ] \
  && ! git diff "$base...$head" -- docs/FEATURES.md | grep -qE "^\+.*#$n([^0-9]|$)"; then
  err "docs/FEATURES.md needs a row for #$n in this PR, or label a chore's PR no-feature-row."
fi

[ "$fail" = 0 ] && echo "PR protocol OK for #$n."
exit "$fail"
