/**
 * Path-based proxy URLs: /api/p/<token>/<scheme>/<host>/<path>?<query>
 * Keeping the upstream path structure inside our own path means relative
 * references resolve in the browser exactly as they would upstream.
 */
export const PROXY_PREFIX = '/api/p/';

export function toProxyPath(absoluteUrl, token) {
  const url = new URL(absoluteUrl);
  const scheme = url.protocol.replace(':', '');
  return `${PROXY_PREFIX}${token}/${scheme}/${url.host}${url.pathname}${url.search}`;
}

/** Inverse of toProxyPath. `rawPath` must be the undecoded request path + query. */
export function fromProxyPath(rawPath) {
  if (!rawPath.startsWith(PROXY_PREFIX)) return null;
  const rest = rawPath.slice(PROXY_PREFIX.length);
  const match = rest.match(/^([^/]+)\/(https?)\/([^/?#]+)(.*)$/);
  if (!match) return null;
  const [, token, scheme, host, tail] = match;
  const pathAndQuery = tail.startsWith('/') || tail.startsWith('?') || tail === '' ? tail : `/${tail}`;
  return { token, url: `${scheme}://${host}${pathAndQuery || '/'}` };
}

function proxify(reference, baseUrl, token) {
  const trimmed = reference.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('skd:')) return reference;
  let resolved;
  try {
    resolved = new URL(trimmed, baseUrl);
  } catch {
    return reference;
  }
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return reference;
  return toProxyPath(resolved.toString(), token);
}

/** Rewrites every URI in an HLS playlist (media lines and URI="..." attributes). */
export function rewriteM3u8(text, baseUrl, token) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]*)"/g, (_, uri) => `URI="${proxify(uri, baseUrl, token)}"`);
      }
      return proxify(trimmed, baseUrl, token);
    })
    .join('\n');
}

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unescapeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const ABSOLUTE_OR_ROOT = /^(https?:)?\/\//i;

/**
 * Rewrites a DASH manifest:
 *  - MPD-level BaseURL (or an injected one) points at the proxied directory of
 *    the final upstream URL, so relative segment templates resolve through us.
 *  - Absolute BaseURLs / media / initialization / sourceURL references are proxied.
 */
export function rewriteMpd(xml, finalUrl, token) {
  const firstPeriod = xml.search(/<(\w+:)?Period[\s>]/);
  const head = firstPeriod === -1 ? xml : xml.slice(0, firstPeriod);
  const body = firstPeriod === -1 ? '' : xml.slice(firstPeriod);

  const rewriteBaseUrls = (segment, resolveRelative) =>
    segment.replace(/<((?:\w+:)?BaseURL)([^>]*)>([^<]*)<\/\1>/g, (full, tag, attrs, value) => {
      const raw = unescapeXml(value.trim());
      if (ABSOLUTE_OR_ROOT.test(raw) || raw.startsWith('/') || resolveRelative) {
        return `<${tag}${attrs}>${escapeXml(proxify(raw, finalUrl, token))}</${tag}>`;
      }
      return full;
    });

  let newHead = rewriteBaseUrls(head, true);
  const hasMpdLevelBase = /<(\w+:)?BaseURL[\s>]/.test(head);
  if (!hasMpdLevelBase) {
    const directory = new URL('.', finalUrl).toString();
    newHead = newHead.replace(/(<(\w+:)?MPD\b[^>]*>)/, (openTag, _full, ns) => {
      const tag = `${ns ?? ''}BaseURL`;
      return `${openTag}<${tag}>${escapeXml(toProxyPath(directory, token))}</${tag}>`;
    });
  }

  let newBody = rewriteBaseUrls(body, false);
  newBody = newBody.replace(/\b(media|initialization|sourceURL|href)="([^"]*)"/g, (full, attr, value) => {
    const raw = unescapeXml(value);
    if (ABSOLUTE_OR_ROOT.test(raw) || raw.startsWith('/')) {
      return `${attr}="${escapeXml(proxify(raw, finalUrl, token))}"`;
    }
    return full;
  });
  return newHead + newBody;
}

export function detectManifestKind(urlString, contentType) {
  const type = String(contentType ?? '').toLowerCase();
  if (type.includes('mpegurl') || type.includes('x-mpegurl')) return 'hls';
  if (type.includes('dash+xml')) return 'dash';
  let pathname = '';
  try {
    pathname = new URL(urlString).pathname.toLowerCase();
  } catch {
    return null;
  }
  if (pathname.endsWith('.m3u8') || pathname.endsWith('.m3u')) return 'hls';
  if (pathname.endsWith('.mpd')) return 'dash';
  return null;
}
