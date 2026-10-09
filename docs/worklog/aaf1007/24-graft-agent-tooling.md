# #24 Add graft repo context graph tooling for agents

Status: done
Branch: chore/24-graft-agent-tooling
Updated: 2026-10-09 13:10

## Goal
Wire graft (a prebuilt repo context graph) into the agent setup so agents query it before grepping or reading source files.

## Done so far
- Claude Code hooks (session-start, prompt, post-edit, tool-savings, stop), status line and graft permissions in `.claude/settings.json`.
- Helper scripts `.claude/helpers/graft-hooks.cjs` and `graft-statusline.cjs`; graft skill in `.claude/skills/graft/`.
- `.mcp.json` registers the graft MCP server.
- `AGENTS.md` gains a "Graft — repo context graph" section.
- `/graft/` (the local graph cache) is gitignored; `.ignore` re-admits it to ripgrep.

## Next steps
None.

## Decisions & gotchas
- The graph isn't committed. Each teammate needs `npm i -g @nanonets/graft` and `graft build` to get one; without it the helpers fall back and the AGENTS.md section points at a tool they don't have.
- Chore with no FEATURES.md row; the PR carries the `no-feature-row` label.

## Files touched
- `.claude/settings.json`, `.claude/helpers/*`, `.claude/skills/graft/SKILL.md`, `.mcp.json`, `.ignore`, `.gitignore`, `AGENTS.md`
