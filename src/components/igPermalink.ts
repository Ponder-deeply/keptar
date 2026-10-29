// Instagram post URL parsing, kept separate from IgEmbed so it can be unit-tested.

const IG_POST_RE = /^https?:\/\/(?:www\.)?instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?/

/**
 * The canonical permalink of an Instagram post or reel, or null when `url` is not one.
 * The result only contains URL-safe characters, so it can go into HTML attributes as is.
 */
export function parseIgPermalink(url: string | null | undefined): string | null {
  if (!url) return null
  const match = IG_POST_RE.exec(url.trim())
  if (!match) return null
  return `https://www.instagram.com/${match[1]}/${match[2]}/`
}
