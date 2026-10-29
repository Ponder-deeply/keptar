---
paths:
  - "src/app/(site)/**"
  - "src/components/**"
  - "src/lib/**"
---

# Public site code

- Payload's Local API skips access control by default. A query made for a
  visitor passes `overrideAccess: false` (and `user` when logged in). Use
  `overrideAccess: true` only for server-side writes the visitor can't make
  themselves (inquiries, profile requests, swipe side effects), with a comment
  saying why.
- Get the visitor with `payload.auth({ headers })`. Read the site URL with
  `serverURL()` from `src/lib/serverURL.ts`, never a `NEXT_PUBLIC_*` variable.
- UI text, routes and query params are Hungarian (`/muveszek`, `?technika=`,
  `rendezes`, `oldal`). Code, identifiers and comments are English.
- Rate-limited forms use `src/lib/rateLimit.ts`; the client IP is the last
  `X-Forwarded-For` entry.
- This Next.js version differs from training data. Check
  `node_modules/next/dist/docs/` or the next-devtools MCP before using an API.
- Design is deferred: keep styling minimal and in `styles.css`; don't add UI libraries.
