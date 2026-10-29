# Képtár: project plan

## Context

`Personal/Projects/Képtár/DIMI1.md` is Dimitrij Vincze's vision for a
non-profit showcase of contemporary Hungarian visual artists. Roles: Dimitrij
owns the artistic vision; the user builds it and maintains it with AI. It's a
personal expense with no deadline and no legal entity yet. The aim is an MVP
first, with design decided after the MVP exists.

Decisions so far (from the user's answers):
- **Seed content:** about 200 artists Dimitrij follows on Instagram, with their
  posts *embedded*. Artists upload their own work after the MVP. Using their
  photos is acceptable because it gives them exposure.
- **Photo guidelines** come later. "Utófényelés" means AI upscaling plus an
  automatic quality check, and it is **not part of the MVP**.
- **Inquiries** go straight to the artist, and the site tracks them. GDPR
  handling should be as frictionless as possible: no marketing use, no selling
  of data.
- **Facebook:** pull events only, never push.
- **Swipe** shuffles the images on the site. A right swipe saves the work and
  feeds recommendations.
- **Vote:** registered users only; cheating is not a concern yet.
- Website only, no PWA. Design is deferred.

## Stack (chosen for one builder maintaining it with AI)

Pick the most mainstream stack, so that AI tools know it well:
- **Next.js + Payload CMS 3 + Postgres**, all TypeScript in one repo. Payload
  provides admin, auth and roles (admin / curator / artist / user), uploads and
  i18n, which means no custom backend.
- **Hosting:** Hetzner VPS (Docker Compose), around €5/month. Cloudflare R2 for
  media once artists upload (R2 has no egress fees).
- **Email:** Resend or Brevo free tier, for inquiry relay and login links.
- **Map:** MapLibre + OSM tiles (free).
- **Deep zoom:** for later, once uploads exist (sharp → DZI tiles → OpenSeadragon).

## The Instagram seeding pipeline (the main technical risk)

1. **Following list:** Dimitrij exports his data from Instagram (Accounts
   Center → Download your information → *Followers and following*, JSON). This
   is official, safe and free, and needs no scraping.
2. **Filter to artists:** a script loads the list, and Dimitrij ticks the
   artists in the Payload admin (he's the curator).
   **Tagging:** a script sends each artist's bio and post images to Claude
   (`claude-sonnet-5-5`, vision), which proposes medium/technique/region tags
   as drafts. Dimitrij corrects them in the admin before publishing.
3. **Picking posts:** Instagram has no public API for other people's posts, and
   scraping profiles breaks quickly and gets accounts banned. The plan is to
   store the profile URL plus **3–6 post URLs per artist**:
   - preferred: Dimitrij or the user pastes post URLs into the admin; with 200
     artists × 5 posts this is a few evenings' work;
   - optional speed-up: `instaloader` on a **throwaway account**, rate-limited,
     run only to fetch post URLs. Never Dimitrij's own account.
4. **Embed:** Instagram's official embed (blockquote + `embed.js`) shows a post
   with credit and a link back, and needs no token. Limitations: no deep zoom,
   Instagram's frame around the image, and slower page loads. So the gallery
   grid uses lazy-loaded embeds; native images replace them once artists claim
   their profile and upload.
5. **Opt-out:** every scraped profile gets a "Ez az én profilom / távolítsd el"
   link, which leads either to claiming the profile (the artist becomes the
   owner) or to removal. It's cheap and avoids trouble.

## MVP scope

- Artist directory and profile: name, IG handle, medium, technique, region,
  short bio, embedded posts.
- Filters: medium, technique, region; sort by name or newest.
- Swipe page: shuffled works; a right swipe saves to the user's list (login
  required to save; anonymous visitors can still swipe).
- Saved list, with simple recommendations: other works sharing tags with the
  saved ones.
- "Érdeklődöm" form: email to the artist, and an `Inquiry` record (artist,
  work, timestamp, sender email). It is deleted automatically after 12 months,
  and the form carries a one-line privacy notice. This is the most frictionless
  way to meet GDPR: legitimate interest, minimal data, a stated retention period.
- Accounts: email magic link (no passwords).
- Venue map and exhibitions: a simple version, entered by hand in the admin.

**After the MVP:** profile claiming and artist uploads with deep zoom, the
period vote with the winner as homepage hero, curated collections, the open
calls feed (source to be decided then), Facebook event pull, AI upscaling/quality check, video/3D/AR, and
the real design.

**Facebook pull, a constraint to know about:** Meta's API only returns events
of Pages whose admin authorised our app, and that needs Meta app review. So an
artist would have to connect their own FB page. Until then: paste an event
link and fill in the fields by hand.

## Data model

`Artist` (handle, name, medium[], technique[], region, bio, claimedBy?),
`Work` (artist, source: instagram|upload, igUrl | image, tags),
`Venue` (type, lat, lng), `Exhibition`, `Inquiry`, `User` (role, saved[]),
`Swipe` (user, work, dir), and later `VotePeriod`/`Vote`, `Collection`, `Call`.

## Where things live

- Code: `~/Projects/keptar` (new git repo).
- Vault: `Personal/Projects/Képtár/Képtár.md` hub in Hungarian, holding the
  decisions above and a link to `DIMI1.md` (left untouched).

## Orchestration: agents, waves, ownership

I act as orchestrator: I write each agent's prompt, review its diff, merge it,
and run the checks between waves. Each prompt has to stand on its own. It
contains the relevant slice of this plan, the exact files the agent **owns**,
the files it must **not** touch, the commands that count as "done", and a
request to report back changed files, decisions made, and anything unverified.

The rule that makes running agents in parallel safe: **the schema is frozen
after wave 1.** Only the wave 1 agent writes `src/collections/*` and
`payload.config.ts`. A later agent that needs a schema change reports it to me
instead of making it.

**Wave 0: me, inline (no agent)**
- `git init ~/Projects/keptar`.
- Write the vault hub `Personal/Projects/Képtár/Képtár.md` (Hungarian:
  decisions, link to `DIMI1.md`).
- Append a `## [2026-10-29] project | Képtár terv` entry to `Wiki/log.md`.

**Wave 1: one agent (sequential, because everything depends on it)**
- *Scaffold agent* (general-purpose): `create-payload-app` with the Next.js and
  Postgres template; SQLite (`@payloadcms/db-sqlite`) for local dev, Postgres adapter switchable by env for production; **all** MVP collections
  from the data model (Artist, Work, Venue, Exhibition, Inquiry, User with
  roles and `saved[]`, Swipe), with access control per role; magic-link auth;
  seed script with about 5 fake artists. It also writes
  `CLAUDE.md` for the repo (stack, commands, schema-frozen rule), so that later
  AI maintenance has the context.
  Done = `pnpm dev`, the admin logs in, the seed runs,
  `pnpm build` and `tsc` pass.

**Wave 1 outcome (done 2026-10-29, done inline rather than by an agent).**
Differences from the plan above, which Wave 2 prompts must reflect:
- Extra collections: `tags` (medium/technique/subject vocabulary, so curators
  can add tags without a schema change) and `profile-requests` (claim/remove
  requests behind the opt-out link).
- `artists.status` is pending | published | rejected | hidden. The import
  creates `pending`; "ticking" an artist means setting `published`; opt-out sets
  `hidden`. `aiTagged` marks AI-proposed tags awaiting review.
- The 12-month inquiry purge (`src/jobs/purge-inquiries.ts`) is already written
  and registered. The *Inquiry* agent only needs the form, the mail and the record.
- The right-swipe → `users.saved` logic is a hook in `Swipes.ts`; the *Swipe*
  agent only creates `swipes` records.
- A minimal `/belepes` magic-link login page exists; *Public pages* may restyle it.
- Inquiries need an artist email; most imported artists have none, so the
  record is still created with `delivered: false` and staff follow up.

**Wave 2: four agents in parallel, each in its own `isolation: "worktree"`**
| Agent | Owns | Done when |
|---|---|---|
| *Import + tagging* | `scripts/import-instagram.ts`, `scripts/tag-artists.ts` | Takes a sample IG export JSON (agent writes a fixture), creates draft Artists, and gives Claude vision tag proposals (uses the `claude-api` skill for model and SDK) via a dry-run flag |
| *Public pages* | `src/app/(site)/artists/**`, `components/IgEmbed*`, filters | Directory, profile with lazy IG embeds, and medium/technique/region filters all work on the seed data |
| *Swipe + saved* | `src/app/(site)/swipe/**`, `saved/**`, `lib/recommend.ts` | Shuffle with no repeats within a session, right swipe saves (login required), recommendations by tag overlap |
| *Inquiry* | `src/app/(site)/**/inquiry*`, `lib/mail.ts`, `jobs/purge-inquiries.ts` | Form sends mail to the artist (Resend dev mode / log transport), creates the Inquiry record, and a 12-month purge job runs |

A shared layout or nav file is owned by *Public pages*; the others list the
links they need, and I add them at merge.

**Wave 3: me, then one agent**
- I merge the worktrees one at a time and run `pnpm build`, `tsc` and lint
  after each merge, fixing conflicts myself.
- *Review agent* (general-purpose, read-only brief): check the whole repo
  against the Verification list below and report failures, without fixing
  them. I fix the failures, or send a targeted agent back.

**Wave 4: one agent, after the user OKs it**
- *Deploy agent*: Hetzner VPS Docker Compose, Caddy TLS, env/secrets, backups
  with `pg_dump` cron. Only after the user provides the server and domain,
  because this is outward-facing.

**Real data, by the user and Dimitrij:** run the IG export, the import script,
the tagging script, and curation in the admin.

## Verification

- Importing the export JSON creates about 200 draft artists; ticking an artist
  publishes it.
- A profile shows its embedded posts, credited and linked to Instagram.
- Filters return the right artists; the swipe shuffle has no repeats within a
  session; saved works persist after logging in again.
- An inquiry reaches the artist's mailbox, the record appears in the admin, and
  a record older than 12 months is purged by the job.
- The opt-out link removes or hides a profile.
