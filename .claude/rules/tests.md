---
paths:
  - "tests/**"
  - "vitest.config.mts"
  - "playwright.config.ts"
---

# Tests

- Int tests (`tests/int/*.int.spec.ts`, Vitest) use the one local SQLite DB and
  assume seeded data. Run `pnpm seed` first if the DB is missing or was changed.
  Files run serially (`fileParallelism: false`), so don't turn parallelism on.
- Tests that create records clean them up and use unique values, because the DB
  is shared with the dev server.
- E2E (`tests/e2e`, Playwright) starts or reuses `pnpm dev` on :3000.
- Access-control changes need a test that checks what an anonymous visitor
  gets, not only staff (see `public.int.spec.ts`, `api.int.spec.ts`).
