---
paths:
  - "scripts/**"
  - "docs/INSTAGRAM.md"
---

# Import and tagging scripts

- `import:instagram` calls the Meta Graph API (rate-limited, uses our token) and
  `tag:artists` calls the Claude API (costs money, even with `--dry-run`). Run them
  only when the user asks. While developing, use `import:instagram --dry-run` or
  `--handles-only`, and `tag:artists --dry-run --limit 1` (or `--handle <h>`).
- Tests mock the network (`tests/int/instagram-graph.int.spec.ts`,
  `import.int.spec.ts`). Add a mocked test for new API behaviour; don't hit the
  real APIs in tests.
- Tokens come from `.env` via `process.env`; never log them or write them to files.
  Document new variables in `.env.example`.
- For Claude model IDs and SDK usage, load the `claude-api` skill first.
- Scripts run through `payload run`, so they use the Local API with
  `overrideAccess: true`. Imported artists are always created as `pending`.
