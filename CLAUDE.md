# Képtár

Non-profit showcase site for contemporary Hungarian visual artists.
Vision: Dimitrij Vincze. Builder/maintainer: the user, with AI.

## Start here

- **Tasks and plan:** `docs/PLAN.md`. The MVP scope, the data model and the
  agent waves (Wave 1 scaffold → Wave 2 four parallel agents → Wave 3
  merge/review → Wave 4 deploy). Wave 0 is done. Next is **Wave 1**.
- **Product vision (Hungarian, Dimitrij's wording):**
  `~/Documents/Brain/Personal/Projects/Képtár/DIMI1.md` (read-only, never edit).
- **Decisions hub (Hungarian):** `~/Documents/Brain/Personal/Projects/Képtár/Képtár.md`.
  Update it when a product decision changes.

## Rules

- Stack: Next.js + Payload CMS 3, TypeScript. SQLite (`@payloadcms/db-sqlite`)
  locally; Postgres in production, with the adapter chosen by env.
- After Wave 1 the schema is frozen: only the orchestrating session edits
  `src/collections/*` and `payload.config.ts`; agents report needed schema changes.
- UI language Hungarian; code and comments English.
