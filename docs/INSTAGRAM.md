# Instagram access setup

`pnpm import:instagram` reads followed artists' profiles and post links through
the official Graph API *Business Discovery* endpoint. That needs four things
from Meta: an Instagram professional account of our own, a Facebook Page linked
to it, a Meta app, and a user token. Setup takes about 20 minutes, once.

Business Discovery only sees **business and creator** accounts. Personal
accounts are imported handle-only, and their post URLs are pasted into the admin
by hand.

## 1. Instagram professional account

Use a Képtár account (not Dimitrij's personal one). In the Instagram app:
*Settings → Account type and tools → Switch to professional account*. Either
*Creator* or *Business* works.

## 2. Facebook Page linked to it

Create a Facebook Page (e.g. "Képtár") with any Facebook account that will also
own the Meta app. Then link the Instagram account: in the Page's
*Settings → Linked accounts → Instagram → Connect*, or from Instagram under
*Accounts Center*.

## 3. Meta app

1. At <https://developers.facebook.com/apps>, *Create app*, with the same
   Facebook account.
2. Pick the *Other* use case, then the *Business* app type. Name it e.g.
   "Képtár import".
3. On the app dashboard, add the **Instagram** product and choose
   *API setup with Facebook login*.
4. Leave the app in **Development** mode. App roles (you) get these permissions
   without App Review, which is all this script needs.
5. Under *App settings → Basic*, copy the **App ID** and **App Secret** into
   `.env`:

   ```
   META_APP_ID=...
   META_APP_SECRET=...
   ```

## 4. Token

1. Open the Graph API Explorer: <https://developers.facebook.com/tools/explorer>.
2. Select the app from step 3. Under *User or Page*, choose *User Token*.
3. Add these permissions: `instagram_basic`, `instagram_manage_insights`,
   `pages_read_engagement`, `pages_show_list`.
4. Click *Generate Access Token*. In the Facebook dialog, select the Page
   **and** the Instagram account from steps 1–2.
5. Copy the token (it lasts about an hour) and run:

   ```
   pnpm instagram:token <token> --write
   ```

   This exchanges it for a long-lived token (about 60 days), finds the
   Instagram account's ID, tests Business Discovery on it, and writes
   `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN` to `.env`. Without
   `--write` it only prints them.

## 5. Import

```
pnpm import:instagram path/to/following.json --dry-run
pnpm import:instagram path/to/following.json
```

If Meta rate-limits the run, it stops and says so. Wait an hour and rerun with
`--update-posts` to finish the artists that were only half fetched.

## Renewing

The token expires after about 60 days. Repeat step 4; the app and Page stay.
Errors like `Error validating access token` (code 190) mean it has expired.

## Without a token: instaloader

[instaloader](https://github.com/instaloader/instaloader) also sees personal
accounts. Instagram's Terms restrict automated collection, so download
metadata only (no images; the site embeds posts), in small batches:

```
pipx install instaloader
instaloader --login <képtár-account> \
  --no-pictures --no-videos --no-video-thumbnails --no-profile-pic \
  --no-captions --no-compress-json --latest-stamps ig-export/latest-stamps.ini \
  --dirname-pattern 'ig-export/{profile}' <handle> <handle> …
```

Anonymous runs are mostly blocked by Instagram now (401 / "Please wait a few
minutes"), hence `--login`. Use the Képtár account, never Dimitrij's: a
throwaway-looking burst of requests can get the logged-in account
checkpointed. If instaloader reports a checkpoint or 429, stop and continue
another day; `--latest-stamps` then fetches only posts newer than the last
run (`--fast-update` can't be combined with `--no-pictures`).

For the whole following list, `pnpm instaloader:batches` runs that command in
sections with a pause between them, and stops on a fatal error with the
`--start` value to resume from:

```
pnpm instaloader:batches following.json --sections 10 --delay 30m --login <képtár-account> --dry-run
```

Then import the directory (it is detected as instaloader by being a directory):

```
pnpm import:instagram ig-export --dry-run
pnpm import:instagram ig-export --update-posts
```

`--update-posts` adds the posts to artists already imported from the following
list and fills their blank name, bio and website. Private accounts keep their
name but get no posts. `.json.xz` files (instaloader's default without
`--no-compress-json`) also work if the `xz` command is installed.
