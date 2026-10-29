---
name: schema-change
description: Procedure for changing Képtár's frozen Payload schema (collections, fields, access rules, payload.config.ts). Use when a collection, field, relationship, hook or access rule must change, or when a subagent reports a needed schema change. Orchestrating session only.
argument-hint: "[what changes and why]"
---

# Change the schema

Change requested: $ARGUMENTS

The schema is frozen (CLAUDE.md), so only the orchestrating session does this,
one change at a time, while no agent worktrees are working off the old schema.
If agents are running, wait for them, or tell them about the change before
merging their work.

1. **Design.** State the change: collection, field, type, who can read and
   write it, and whether the public API exposes it. Check it against the
   invariants in `.claude/rules/payload-schema.md`. If it changes a product
   decision, also use the `record-decision` skill.
2. **Edit** `src/collections/<Name>.ts` (and `payload.config.ts` only for
   registration, jobs, adapters). Hungarian labels. Use access helpers from
   `src/access/roles.ts`.
3. **Generate**: `pnpm generate:types`. If admin components changed,
   also `pnpm generate:importmap`.
4. **Seed**: update `src/seed.ts` so new required fields get values. Then ask
   before running `pnpm seed`, which wipes local content.
5. **Tests**: add or extend an int test that covers what an anonymous visitor
   gets and what staff gets, for every access change.
6. **Docs**: update the Schema section of `CLAUDE.md`. If it changes the data
   model, update `docs/PLAN.md` too.
7. **Production**: Postgres runs with `push: false`. Until Wave 4 sets up migrations, add the
   change to the Wave 4 list in `docs/PLAN.md`. After that,
   `pnpm payload migrate:create <name>` against a Postgres `DATABASE_URL`.
8. **Check**: run the `verify` skill (`full`), then the `access-auditor` agent on the diff.
