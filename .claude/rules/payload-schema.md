---
paths:
  - "src/collections/**"
  - "src/payload.config.ts"
  - "src/access/**"
  - "src/endpoints/**"
  - "src/jobs/**"
---

# Payload schema and access control

- The schema is frozen: only the orchestrating session changes collections or
  `payload.config.ts` (a hook blocks subagents). Follow the `schema-change` skill.
- Data-exposure invariants. Every change must keep all of them true:
  - Visitors see only `published` artists, and only works, media and
    exhibition data that belong to them. `pending`, `rejected` and `hidden`
    artists must not leak through relationships, joins, `depth` or `/api/*`.
  - `email`, `claimedBy`, `curatorNotes` and other staff fields carry
    `staffOnlyField`, not just `admin.hidden`.
  - `inquiries`, `profile-requests` and the jobs queue are staff-read only and are
    created server-side.
  - Users can't change their own `role`, `email` or `password` (only admins can, see
    the hook in `Users.ts`).
- Use the helpers in `src/access/roles.ts`; don't inline role checks.
- Collection and field labels are Hungarian (`labels`, `label`, `admin.description`).
- Postgres runs with `push: false`, so production needs a migration for every
  schema change (Wave 4 sets this up; until then, note the change in docs/PLAN.md).
