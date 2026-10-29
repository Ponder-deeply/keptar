---
name: verify
description: Run Képtár's quality gate (typecheck, lint, int tests, build, optionally e2e) and triage failures. Use before saying work is done, after merging a branch, or when the user asks to check, verify or test the project.
argument-hint: "[quick|full|e2e]"
allowed-tools: Bash(pnpm typecheck) Bash(pnpm lint) Bash(pnpm test:int) Bash(pnpm test:int *) Bash(pnpm build) Bash(pnpm test:e2e) Bash(pnpm test:e2e *) Bash(git status*) Bash(git diff*)
---

# Verify

Mode: `$ARGUMENTS` (default `quick`).

| Mode | Steps |
|---|---|
| quick | `pnpm typecheck`, `pnpm lint`, `pnpm test:int` |
| full | quick + `pnpm build` |
| e2e | full + `pnpm test:e2e` |

Run the steps in order and stop at the first failing step. Fix it, then rerun from that step.

## Before running

- In a fresh worktree, `node_modules` is installed automatically on the first
  `pnpm` call (`.claude/hooks/worktree-setup.sh`).
- Int tests need a seeded SQLite DB. If `keptar.db` is missing, or the tests fail
  on missing seed artists, users or tags, ask before running `pnpm seed`: it wipes
  content in this checkout's DB.
- `pnpm build` and `pnpm dev` both write `.next/`. Stop a running dev server
  in the same checkout before building, or the build fails or corrupts the dev cache.

## Triage

- **Typecheck errors in `payload-types.ts` consumers** after a schema change:
  run `pnpm generate:types` and don't edit the generated file.
- **Lint**: the config has only warnings besides the Next rules. Fix errors, and
  leave existing warnings in files you didn't touch.
- **"database is locked"**: another process (dev server, another test run)
  holds the SQLite file. Stop it or wait. Never enable file parallelism.
- **Build-only failures** (it typechecks but fails to build): usually a server-only
  import in a client component, or env read at build time. Runtime config
  belongs in `serverURL()` or `process.env` inside request handlers.
- **E2E**: Playwright reuses a dev server on :3000 if one is running, and that
  server might be on another branch's code. Check which checkout it's serving.

## Report

Report each step as pass or fail, with the failing output trimmed to the
relevant lines. Name anything you skipped and why (for example, e2e not run).
