/**
 * Custom request headers travel inside the proxy URL as a base64url JSON token so
 * that every derived URL (segments, keys, sub-playlists) carries them along
 * without server-side session state. "_" means "no custom headers".
 */
const ALLOWED_HEADERS = new Set(['referer', 'origin', 'user-agent', 'authorization', 'cookie']);
const HEADER_NAME_RE = /^[a-z0-9!#$%&'*+.^_`|~-]+$/;
const BLOCKED_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'upgrade', 'te', 'trailer', 'keep-alive', 'proxy-authorization', 'proxy-connection']);

export function encodeToken(headers) {
  const clean = sanitizeHeaders(headers);
  if (Object.keys(clean).length === 0) return '_';
  return Buffer.from(JSON.stringify(clean), 'utf8').toString('base64url');
}

export function decodeToken(token) {
  if (!token || token === '_') return {};
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    return sanitizeHeaders(parsed);
  } catch {
    return {};
  }
}

export function sanitizeHeaders(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const [rawName, rawValue] of Object.entries(input)) {
    if (typeof rawValue !== 'string') continue;
    const name = rawName.trim().toLowerCase();
    const value = rawValue.replace(/[\r\n]/g, '').trim();
    if (!name || !value || !HEADER_NAME_RE.test(name) || BLOCKED_HEADERS.has(name)) continue;
    if (!ALLOWED_HEADERS.has(name) && !name.startsWith('x-')) {
      // Arbitrary extra headers are allowed too, but never hop-by-hop ones.
      if (name.startsWith('sec-') || name.startsWith('proxy-')) continue;
    }
    out[name] = value;
  }
  return out;
}
