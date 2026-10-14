import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { config } from './config.js';
import { assertFetchableUrl, guardedLookup } from './netguard.js';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 64, lookup: guardedLookup });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64, lookup: guardedLookup });

/**
 * Builds the outgoing header set: browser-like defaults, then the user's custom
 * headers, then pass-through headers from the player (Range, If-*).
 */
export function buildUpstreamHeaders(customHeaders, passThrough = {}) {
  const headers = {
    'user-agent': config.defaultUserAgent,
    accept: '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'identity',
  };
  for (const [name, value] of Object.entries(customHeaders)) headers[name] = value;
  for (const name of ['range', 'if-range', 'if-none-match', 'if-modified-since']) {
    if (passThrough[name]) headers[name] = passThrough[name];
  }
  return headers;
}

function requestOnce(url, { method, headers, signal }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method,
        headers,
        agent: url.protocol === 'https:' ? httpsAgent : httpAgent,
        timeout: config.upstreamTimeoutMs,
      },
      resolve,
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error('Upstream timed out'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (signal) {
      if (signal.aborted) req.destroy(new Error('aborted'));
      signal.addEventListener('abort', () => req.destroy(new Error('aborted')), { once: true });
    }
    req.end();
  });
}

/**
 * Performs a request following redirects manually so that every hop is
 * re-validated by the network guard. Resolves with the final IncomingMessage
 * and the final URL (needed to resolve relative manifest entries).
 */
export async function fetchUpstream(rawUrl, { method = 'GET', headers = {}, signal } = {}) {
  let url = assertFetchableUrl(rawUrl);
  for (let hop = 0; hop <= config.maxRedirects; hop += 1) {
    const response = await requestOnce(url, { method, headers, signal });
    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume();
      url = assertFetchableUrl(new URL(response.headers.location, url).toString());
      continue;
    }
    return { response, finalUrl: url.toString() };
  }
  throw Object.assign(new Error('Too many redirects'), { code: 'EREDIRECTS' });
}

function decodedStream(response) {
  const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return response.pipe(zlib.createGunzip());
  if (encoding === 'deflate') return response.pipe(zlib.createInflate());
  if (encoding === 'br') return response.pipe(zlib.createBrotliDecompress());
  return response;
}

/** Reads a (possibly compressed) body as text, bounded by maxBytes. */
export function readText(response, maxBytes = config.maxTextBytes) {
  return new Promise((resolve, reject) => {
    const stream = decodedStream(response);
    const chunks = [];
    let total = 0;
    stream.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        stream.destroy();
        response.destroy();
        reject(Object.assign(new Error('Response too large to process'), { code: 'ETOOLARGE' }));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

/** Reads at most `limit` bytes and then aborts the upstream connection. */
export function readHead(response, limit) {
  return new Promise((resolve) => {
    const stream = decodedStream(response);
    const chunks = [];
    let total = 0;
    const finish = () => {
      stream.removeAllListeners('data');
      response.destroy();
      resolve(Buffer.concat(chunks).subarray(0, limit));
    };
    stream.on('data', (chunk) => {
      chunks.push(chunk);
      total += chunk.length;
      if (total >= limit) finish();
    });
    stream.on('end', finish);
    stream.on('error', finish);
  });
}

export function describeNetworkError(error) {
  switch (error?.code) {
    case 'EPRIVATE':
      return { status: 403, reason: 'private-network', message: error.message };
    case 'EBADURL':
      return { status: 400, reason: 'bad-url', message: error.message };
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return { status: 502, reason: 'dns', message: 'Host could not be resolved' };
    case 'ETIMEDOUT':
      return { status: 504, reason: 'timeout', message: 'Upstream server timed out' };
    case 'ECONNREFUSED':
      return { status: 502, reason: 'refused', message: 'Upstream refused the connection' };
    case 'EREDIRECTS':
      return { status: 508, reason: 'redirects', message: error.message };
    case 'ETOOLARGE':
      return { status: 413, reason: 'too-large', message: error.message };
    default:
      if (String(error?.code ?? '').startsWith('ERR_TLS') || /certificate/i.test(String(error?.message))) {
        return { status: 502, reason: 'tls', message: 'TLS / certificate error talking to upstream' };
      }
      return { status: 502, reason: 'network', message: error?.message ?? 'Upstream request failed' };
  }
}
