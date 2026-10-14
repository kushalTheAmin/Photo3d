/**
 * Static (server-side) video sniffer: finds media references in raw HTML,
 * including JSON-escaped URLs in inline scripts, OpenGraph tags and embeds of
 * known video platforms.
 */
const MEDIA_EXT = /\.(m3u8|mpd|mp4|m4v|webm|ogv|ogg|mov|mkv)(?=$|[?#])/i;
const URL_IN_TEXT = /(?:https?:)?\/\/[^\s"'<>()\\`]+?\.(?:m3u8|mpd|mp4|m4v|webm|ogv|ogg|mov|mkv)(?:\?[^\s"'<>\\`]*)?(?=$|[\s"'<>\\`)])/gi;
const PLATFORM_HOSTS = /(youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|twitch\.tv|dailymotion\.com|dai\.ly|streamable\.com)/i;

export function kindFromUrl(url) {
  const match = url.match(MEDIA_EXT);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  if (ext === 'm3u8') return 'hls';
  if (ext === 'mpd') return 'dash';
  return 'video';
}

function normalizeEscapes(text) {
  return text
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/');
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function absolutize(reference, baseUrl) {
  try {
    const url = new URL(decodeEntities(reference.trim()), baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function extractTitle(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (og) return decodeEntities(og[1]).trim();
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return title ? decodeEntities(title[1]).trim() : '';
}

export function sniffHtml(html, pageUrl) {
  const found = new Map();
  const add = (reference, source, forcedKind) => {
    const url = absolutize(reference, pageUrl);
    if (!url || found.has(url)) return;
    const kind = forcedKind ?? kindFromUrl(url);
    if (!kind) return;
    found.set(url, { url, kind, source });
  };

  for (const match of html.matchAll(/<(video|audio|source)\b[^>]*?\s(?:data-)?src=["']([^"']+)["']/gi)) {
    const url = absolutize(match[2], pageUrl);
    if (url && !url.startsWith('blob:')) add(match[2], `<${match[1].toLowerCase()}> tag`, kindFromUrl(url) ?? 'video');
  }

  for (const match of html.matchAll(/<meta[^>]+(?:property|name)=["'](og:video(?::url|:secure_url)?|twitter:player:stream)["'][^>]*content=["']([^"']+)["']/gi)) {
    add(match[2], `meta ${match[1]}`);
  }
  for (const match of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](og:video(?::url|:secure_url)?)["']/gi)) {
    add(match[1], `meta ${match[2]}`);
  }

  for (const match of html.matchAll(/"(?:contentUrl|embedUrl)"\s*:\s*"([^"]+)"/g)) {
    const reference = normalizeEscapes(match[1]);
    if (PLATFORM_HOSTS.test(reference)) add(reference, 'JSON-LD', 'embed');
    else add(reference, 'JSON-LD');
  }

  for (const match of html.matchAll(/<iframe\b[^>]*?\ssrc=["']([^"']+)["']/gi)) {
    if (PLATFORM_HOSTS.test(match[1])) add(match[1], 'embedded player', 'embed');
  }

  const normalized = normalizeEscapes(html);
  for (const match of normalized.matchAll(URL_IN_TEXT)) {
    add(match[0], 'inline script / markup');
  }

  const priority = { hls: 0, dash: 1, video: 2, embed: 3 };
  return [...found.values()].sort((a, b) => priority[a.kind] - priority[b.kind]);
}
