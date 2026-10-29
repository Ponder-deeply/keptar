# Képtár

Non-profit showcase site for contemporary Hungarian visual artists.
Vision: Dimitrij Vincze. Builder/maintainer: the user, with AI.

## Start here

- **Tasks and plan:** `docs/PLAN.md`. The MVP scope, the data model and the
  agent waves (Wave 1 scaffold → Wave 2 four parallel agents → Wave 3
  merge/review → Wave 4 deploy). Waves 0–3 are done. Next is **Wave 4** (needs the user's server and domain).
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
- Public pages live under `src/app/(site)/`; Payload admin/API under `src/app/(payload)/`.

## Claude Code setup (`.claude/`, `.mcp.json`)

- Skills: `verify` (quality gate), `dev-server` (run, log in, drive the app),
  `schema-change`, `agent-brief` (wave prompts and merging), `record-decision`.
- Agents: `access-auditor` (data exposure and GDPR, read-only), `plan-verifier`
  (checks docs/PLAN.md's Verification list).
- Hooks: lint each edited file; block the end of a turn while `tsc` fails;
  block generated files, `.env`, the lockfile, `DIMI1.md`, and schema edits by
  subagents; refuse `pnpm seed` against Postgres.
- Worktrees branch from local HEAD and get `.env`, `keptar.db` and `media/`
  (`.worktreeinclude`). `node_modules` installs on the first pnpm command.
- MCP: `next-devtools` (runtime errors and routes of the running dev server)
  and `playwright` (headless browser).

## Commands

- `pnpm dev`: dev server on http://localhost:3000 (admin at `/admin`).
- `pnpm seed`: wipe content and recreate fake data (6 artists, 24 works, venues,
  exhibitions). Users are upserted: `admin@keptar.local` / `keptar-admin`,
  `kurator@keptar.local` / `keptar-kurator`, `latogato@keptar.local` / `keptar-latogato`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:int` (needs a seeded DB).
- After a schema change: `pnpm generate:types` (and `pnpm generate:importmap`
  if admin components changed).

## Schema (frozen; see `src/collections/`)

- `artists`: `handle` (IG name, unique, the profile URL), `status`
  pending | published | rejected | hidden. The public only sees `published`;
  `email`, `claimedBy`, `curatorNotes` are staff-only fields.
- `works`: `artist`, `source` instagram (`igUrl`) | upload (`image` → `media`),
  `tags`. The public only sees works of published artists.
- `tags`: `kind` medium | technique | subject, with `slug` for URL filters.
  Artists' `medium` / `technique` and works' `tags` point here.
- `venues` (lat/lng), `exhibitions` (venue, artists, dates; visitors only get
  the published artists, via an afterRead hook).
- `inquiries` and `profile-requests`: created server-side only, with
  `overrideAccess: true`; staff read them. `jobs/purge-inquiries.ts` deletes
  inquiries older than 12 months (nightly Payload job; `src/instrumentation.ts`
  starts the job crons at server boot). Payload's internal `payload-jobs-stats`
  global and `payload-locked-documents` are restricted to staff at the end of
  `payload.config.ts`.
- `swipes`: logged-in users only; `user` is forced to the requester, and a right
  swipe adds the work to `users.saved` (hook in `Swipes.ts`).
- `users`: `role` admin | curator | artist | user (only admins change it), `saved`.
  Only admins can change a user's `email` or `password` (hook in `Users.ts`).
  Access helpers: `src/access/roles.ts`.
- `media`: the public can only read files used by a published artist's work or
  an exhibition.

## Auth and email

- Visitors log in by magic link: the form at `/belepes` posts to
  `POST /api/users/magic-link`; the emailed link opens
  `GET /api/users/magic-link/verify`, a page with a "Belépés" button whose
  `POST` to the same path uses up the token and sets the Payload cookie
  (`src/endpoints/magicLink.ts`). The GET never uses up the token, because mail
  scanners open links first. Staff can also use the admin password login.
- Get the logged-in user server-side with `payload.auth({ headers })`.
- Shared input helpers (email check, handle normalisation, `escapeHtml`) live in
  `src/lib/validation.ts`; Instagram post URLs in `src/components/igPermalink.ts`.
- Email goes through `payload.sendEmail`. Without `RESEND_API_KEY` the whole
  message (including links) is printed to the dev server log; production refuses
  to start without it. `INQUIRY_FALLBACK_EMAIL` is the staff inbox: inquiries for
  artists without an email, and every claim/remove profile request.
- The site URL comes from the server-only `SERVER_URL`, read at runtime
  (`src/lib/serverURL.ts`); don't use a `NEXT_PUBLIC_*` variable for it.
- In-memory rate limits (`src/lib/rateLimit.ts`) on the magic link, the
  inquiry form and the profile-request form; the client IP is the last `X-Forwarded-For` entry (Caddy's).
- Payload accepts the auth cookie only from same-origin requests, so testing
  with curl needs `-H 'Sec-Fetch-Site: same-origin'`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
