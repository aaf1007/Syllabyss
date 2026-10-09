#!/usr/bin/env bash
# Prints the team's coordination status so an agent starts every session knowing
# what's merged, what's claimed, and whether its branch is stale.
# Run by the Claude Code SessionStart hook (.claude/settings.json); any agent or
# human can also run it by hand: `bash scripts/agent-sync.sh`.
# Never fails: every step degrades to a note if git/gh/network is unavailable.

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0

echo "=== Team sync (scripts/agent-sync.sh) ==="

if git fetch --quiet --prune origin 2>/dev/null; then
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
  echo "Branch: ${branch}  |  commits on origin/main not in this branch: ${behind}"
  if [ "${behind}" != "0" ] && [ "${behind}" != "?" ]; then
    echo "  -> Recently merged into main (newest first):"
    git log --oneline --no-merges HEAD..origin/main 2>/dev/null | head -10 | sed 's/^/     /'
    echo "  -> Ask the user before merging origin/main into this branch."
  fi
else
  echo "Branch status: could not fetch origin (offline?)."
fi

echo
echo "--- docs/FEATURES.md on origin/main (what's built) ---"
if git show origin/main:docs/FEATURES.md >/dev/null 2>&1; then
  git show origin/main:docs/FEATURES.md | sed -n '/^| ID/,/^$/p'
elif [ -f docs/FEATURES.md ]; then
  sed -n '/^| ID/,/^$/p' docs/FEATURES.md
else
  echo "(no docs/FEATURES.md yet)"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "!!! Team sync is not set up (GitHub CLI missing). Agent: before any feature work, tell the user"
  echo "!!! to type exactly:  ! bash scripts/setup.sh   (one-time, about a minute)"
elif ! gh auth status >/dev/null 2>&1; then
  echo "!!! Team sync is not set up (not logged in to GitHub). Agent: before any feature work, tell the user"
  echo "!!! to type exactly:  ! bash scripts/setup.sh   (one-time, about a minute)"
else
  echo "--- Claimed / in progress (GitHub issues labelled in-progress) ---"
  gh issue list --state open --label in-progress --limit 30 \
    --json number,title,assignees \
    --jq '.[] | "#\(.number) \(.title)  [\([.assignees[].login] | join(", "))]"' 2>/dev/null \
    || echo "(could not reach GitHub)"
  echo
  echo "--- Open PRs ---"
  gh pr list --state open --limit 15 \
    --json number,title,author,headRefName \
    --jq '.[] | "PR #\(.number) \(.title)  (\(.author.login), \(.headRefName))"' 2>/dev/null \
    || echo "(could not reach GitHub)"

  me=$(gh api user --jq .login 2>/dev/null)
  if [ -n "$me" ]; then
    echo
    echo "--- Your worklogs to resume (docs/worklog/${me}/, any branch, not done) ---"
    # origin/main plus the branches not merged into it. A worklog marked done on any of
    # them is finished, so a stale branch can't bring it back; otherwise the first ref
    # listed (origin/main when it has the file) gives the status shown.
    for ref in origin/main $(git for-each-ref --no-merged origin/main --format='%(refname:short)' refs/heads refs/remotes/origin 2>/dev/null); do
      for f in $(git ls-tree --name-only "$ref" "docs/worklog/${me}/" 2>/dev/null); do
        st=$(git show "$ref:$f" 2>/dev/null | sed -n 's/^Status: *\([a-z-]*\).*/\1/p' | head -1)
        echo "$f ${st:-unknown} $ref"
      done
    done | awk '
      $2 == "done" { done[$1] = 1 }
      !($1 in shown) { shown[$1] = $3 "  " $1 "  (status: " $2 ")"; order[++n] = $1 }
      END { for (i = 1; i <= n; i++) if (!(order[i] in done)) print shown[order[i]] }'
    for f in docs/worklog/"${me}"/*.md; do
      [ -f "$f" ] && ! git ls-files --error-unmatch "$f" >/dev/null 2>&1 && echo "(uncommitted) $f"
    done
  fi
fi

echo
echo "Protocol: docs/agents/coordination.md   Worklogs: docs/worklog/README.md"
exit 0
