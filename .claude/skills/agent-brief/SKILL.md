---
name: agent-brief
description: Write self-contained prompts for parallel worktree agents and merge their branches back, following Képtár's wave orchestration (docs/PLAN.md). Use when splitting work across subagents, starting a new wave, or merging agent worktrees.
---

# Brief and merge agents

The orchestration rules come from `docs/PLAN.md` ("Orchestration: agents,
waves, ownership"). Read its current wave section first.

## Before spawning

- Commit the work on `main` first. Worktrees branch from local `HEAD`
  (`worktree.baseRef: head`, since the repo has no remote), so uncommitted
  changes don't reach the agents.
- Give each agent a disjoint set of files. Shared files (layout, nav,
  `styles.css`) belong to one agent, and the others list what they need from them.
- Agents can't edit the schema (hook-enforced). Make any schema change before
  the wave starts (`schema-change` skill).

## Prompt template

Spawn with `isolation: "worktree"`. Each prompt must stand on its own:

```
You're building <feature> for Képtár, a Next.js 16 + Payload 3 site showcasing
Hungarian visual artists. Read CLAUDE.md first.

Context: <the slice of docs/PLAN.md this agent needs, plus related decisions>

You own (create/edit only these): <paths>
Don't touch: src/collections/*, src/payload.config.ts, <other agents' paths>.
If you need a schema change, stop and describe it in your report.

Your worktree has .env and a copy of the SQLite DB. Dependencies install on
your first pnpm command. Seeding (`pnpm seed`) only affects your copy.

Done when: <behaviour on the seed data> and `pnpm typecheck`, `pnpm lint`,
`pnpm test:int` pass. Add int tests for <...>.

Commit your work on your branch with a descriptive message. Report: changed
files, decisions you made, anything unverified, and needed schema changes.
```

## Merging

1. Merge one branch at a time into `main` (`git merge --no-ff worktree-<name>`),
   in dependency order.
2. After each merge, run the `verify` skill (`full`) and fix conflicts and
   breakage before the next merge.
3. Review the combined result with the `access-auditor` agent, plus
   `plan-verifier` at the end of a wave.
4. Record the wave outcome in `docs/PLAN.md`, the same way as the Wave 1–3 outcome notes.
5. Remove merged worktrees: `git worktree remove .claude/worktrees/<name>`
   (unlock first if it's locked), then `git branch -d worktree-<name>`.
