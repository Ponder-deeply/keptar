---
name: dev-server
description: Launch and drive the Képtár app locally to see a change working. Start the dev server, log in as a seed user (password or magic link), call the REST API with curl, read runtime errors via the next-devtools MCP, and take screenshots with the Playwright MCP. Use when asked to run, start, screenshot or click through the app, or to confirm a change in the real app.
---

# Run and drive Képtár

## Start

1. Check whether a server is already up: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/`.
   If one is, find out which checkout it serves before trusting it
   (`ps -o args= -p $(lsof -ti tcp:3000 | head -1)` or `ss -ltnp`).
2. Otherwise run `pnpm dev` with `run_in_background`. It's ready when the log prints
   `Ready`. The first request to `/admin` compiles for 10 to 30 s.
3. In a worktree, use another port if the main checkout's server is running:
   `pnpm dev --port 3001`. Then set `SERVER_URL=http://localhost:3001` in that
   worktree's `.env`, because the magic link and CSRF origin use it.

## Accounts (from `pnpm seed`)

| Role | Email | Password |
|---|---|---|
| admin | admin@keptar.local | keptar-admin |
| curator | kurator@keptar.local | keptar-kurator |
| user | latogato@keptar.local | keptar-latogato |

## Log in from the command line

Payload accepts the cookie only on same-origin requests, so send `Sec-Fetch-Site`:

```sh
jar=$CLAUDE_JOB_DIR/tmp/cookies.txt   # or any scratch path
curl -s -c "$jar" -H 'Content-Type: application/json' -H 'Sec-Fetch-Site: same-origin' \
  -d '{"email":"latogato@keptar.local","password":"keptar-latogato"}' \
  http://localhost:3000/api/users/login | jq '.user.role'
curl -s -b "$jar" -H 'Sec-Fetch-Site: same-origin' http://localhost:3000/api/users/me | jq '.user.email'
```

Magic link (the visitor flow): `POST /api/users/magic-link` with `{"email": ...}`.
Without `RESEND_API_KEY` the email, including the
`/api/users/magic-link/verify?...` link, is printed in the dev server log
between `--- email (not sent) ---` markers. Read it from the background task output.

Anonymous checks: request without the cookie to confirm what visitors can see,
for example `curl -s 'http://localhost:3000/api/artists?limit=100' | jq '[.docs[].status] | unique'`
must be `["published"]`.

## Pages

`/` · `/muveszek` (filters `?medium=&technika=&regio=&rendezes=nev|uj&oldal=`) ·
`/muveszek/<handle>` · `/muveszek/<handle>/profil` (opt-out) · `/felfedezes` (swipe) ·
`/mentett` (login) · `/erdeklodes` · `/kiallitasok` · `/helyszinek` · `/belepes` ·
`/admin`.

## Tools

- **next-devtools MCP**: once the server runs, call its `get_errors` after loading a page
  (hydration, runtime and build errors), plus `get_routes` and `get_logs`.
- **Playwright MCP** (headless): navigate, snapshot and screenshot pages, and
  fill the forms. Instagram embeds load slowly and may be blocked headless;
  don't treat an empty embed frame as a bug.
- Stop the background dev server when you're done, unless the user wants it left running.
