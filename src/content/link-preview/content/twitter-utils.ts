const TWITTER_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.twitter.com'])
const NITTER_HOST = 'nitter.net'
const TWITTER_BLOCKED_TEXT_PATTERN =
  /something went wrong|try again|privacy related extensions|please disable them and try again/i

export function isTwitterStatusUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (!TWITTER_HOSTS.has(host)) return false
    return /\/status\/\d+/.test(parsed.pathname)
  } catch {
    return false
  }
}

export function toNitterUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (!TWITTER_HOSTS.has(host)) return null
    parsed.hostname = NITTER_HOST
    parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return null
  }
}

export function isBlockedTwitterContent(content: string): boolean {
  if (!content) return false
  return TWITTER_BLOCKED_TEXT_PATTERN.test(content)
}
