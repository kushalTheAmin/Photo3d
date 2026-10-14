import { Readable } from 'node:stream';
import { config } from './config.js';
import { decodeToken } from './token.js';
import { buildUpstreamHeaders, describeNetworkError, fetchUpstream, readHead, readText } from './upstream.js';
import { detectManifestKind, fromProxyPath, rewriteM3u8, rewriteMpd } from './manifest.js';
import { extractTitle, sniffHtml } from './sniff.js';
import { snifferScript } from './sniffer-client.js';

const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag', 'cache-control', 'expires', 'content-encoding'];
const EXPOSE = 'Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Upstream-Status, X-Upstream-Url, X-Upstream-Error';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, If-Range, If-None-Match, If-Modified-Since, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', EXPOSE);
}

function sendError(res, error) {
  const info = describeNetworkError(error);
  if (res.headersSent) {
    res.destroy();
    return;
  }
  cors(res);
  res.setHeader('X-Upstream-Error', info.reason);
  res.status(info.status).json({ error: info.reason, message: info.message });
}

function originFor(req) {
  return req.headers.origin ?? `${req.protocol}://${req.headers.host}`;
}

/** Peeks at the first chunk so manifests served as text/plain are still rewritten. */
async function peekStream(response) {
  const iterator = response[Symbol.asyncIterator]();
  const first = await iterator.next();
  const head = first.done ? Buffer.alloc(0) : Buffer.from(first.value);
  const rest = Readable.from(
    (async function* replay() {
      if (head.length) yield head;
      for (;;) {
        const next = await iterator.next();
        if (next.done) return;
        yield next.value;
      }
    })(),
  );
  return { head, rest };
}

function streamToText(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    stream.on('data', (chunk) => {
      total += chunk.length;
      if (total > config.maxTextBytes) {
        stream.destroy();
        reject(Object.assign(new Error('Response too large to process'), { code: 'ETOOLARGE' }));
      } else chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

export async function handleProxy(req, res) {
  const target = fromProxyPath(req.originalUrl);
  if (!target) {
    res.status(400).json({ error: 'bad-url', message: 'Malformed proxy path' });
    return;
  }
  const custom = decodeToken(target.token);
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  try {
    const { response, finalUrl } = await fetchUpstream(target.url, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: buildUpstreamHeaders(custom, req.headers),
      signal: abort.signal,
    });
    const status = response.statusCode ?? 502;
    cors(res);
    res.setHeader('X-Upstream-Status', String(status));
    res.setHeader('X-Upstream-Url', finalUrl);

    let kind = status < 400 ? detectManifestKind(finalUrl, response.headers['content-type']) : null;
    let body = response;
    const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
    const encoding = String(response.headers['content-encoding'] ?? '').toLowerCase();
    const ambiguous = !contentType || contentType.includes('text/plain') || contentType.includes('octet-stream') || contentType.includes('binary');
    if (!kind && status < 400 && req.method !== 'HEAD' && ambiguous && (!encoding || encoding === 'identity') && !response.headers['content-range']) {
      const peeked = await peekStream(response);
      const start = peeked.head.subarray(0, 64).toString('utf8').replace(/^﻿/, '').trimStart();
      if (start.startsWith('#EXTM3U')) kind = 'hls';
      else if (start.startsWith('<?xml') && peeked.head.toString('utf8').includes('<MPD')) kind = 'dash';
      body = peeked.rest;
    }

    if (kind && req.method !== 'HEAD') {
      const text = body === response ? await readText(response) : await streamToText(body);
      const rewritten = kind === 'hls' ? rewriteM3u8(text, finalUrl, target.token) : rewriteMpd(text, finalUrl, target.token);
      res.status(status);
      res.setHeader('Content-Type', kind === 'hls' ? 'application/vnd.apple.mpegurl' : 'application/dash+xml');
      res.setHeader('Cache-Control', 'no-store');
      res.send(rewritten);
      return;
    }

    res.status(status);
    for (const name of PASS_HEADERS) {
      const value = response.headers[name];
      if (value !== undefined) res.setHeader(name, value);
    }
    if (req.method === 'HEAD') {
      response.resume();
      res.end();
      return;
    }
    body.on('error', () => res.destroy());
    body.pipe(res);
  } catch (error) {
    if (abort.signal.aborted) return;
    sendError(res, error);
  }
}

function classifyContentType(contentType, url) {
  const type = contentType.toLowerCase();
  const manifest = detectManifestKind(url, type);
  if (manifest) return manifest;
  if (type.startsWith('video/') || type === 'application/mp4' || type === 'application/ogg') return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.includes('text/html') || type.includes('application/xhtml')) return 'html';
  if (type.startsWith('image/')) return 'image';
  return 'unknown';
}

export async function handleProbe(req, res) {
  cors(res);
  const url = String(req.query.url ?? '');
  const custom = decodeToken(String(req.query.tok ?? '_'));
  const origin = originFor(req);
  try {
    const headers = buildUpstreamHeaders(custom, { range: 'bytes=0-4095' });
    if (!custom.origin) headers.origin = origin;
    const { response, finalUrl } = await fetchUpstream(url, { headers });
    const status = response.statusCode ?? 0;
    const contentType = String(response.headers['content-type'] ?? '');
    const acao = response.headers['access-control-allow-origin'];
    const head = await readHead(response, 4096);
    const text = head.toString('utf8').replace(/^﻿/, '');
    let kind = classifyContentType(contentType, finalUrl);
    if (text.trimStart().startsWith('#EXTM3U')) kind = 'hls';
    else if (/<MPD[\s>]/.test(text)) kind = 'dash';
    const isText = /text|json|xml|html/i.test(contentType) || kind === 'unknown';
    const snippet = status >= 400 && isText ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400) : '';
    const range = String(response.headers['content-range'] ?? '');
    const totalFromRange = range.match(/\/(\d+)$/);
    res.json({
      ok: status < 400,
      status,
      finalUrl,
      contentType,
      kind,
      contentLength: totalFromRange ? Number(totalFromRange[1]) : Number(response.headers['content-length'] ?? 0) || null,
      acceptRanges: status === 206 || String(response.headers['accept-ranges'] ?? '').includes('bytes'),
      corsAllowed: acao === '*' || acao === origin,
      server: String(response.headers.server ?? ''),
      geoHint: status === 451 || /geo|country|region|not available in your/i.test(snippet),
      snippet,
    });
  } catch (error) {
    const info = describeNetworkError(error);
    res.json({ ok: false, status: 0, error: info.reason, message: info.message });
  }
}

export async function handleSniff(req, res) {
  cors(res);
  const url = String(req.query.url ?? '');
  const custom = decodeToken(String(req.query.tok ?? '_'));
  try {
    const headers = buildUpstreamHeaders(custom);
    headers.accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    const { response, finalUrl } = await fetchUpstream(url, { headers });
    const contentType = String(response.headers['content-type'] ?? '');
    const kind = classifyContentType(contentType, finalUrl);
    if (kind !== 'html' && kind !== 'unknown') {
      response.destroy();
      res.json({ pageUrl: finalUrl, status: response.statusCode, title: '', candidates: kind === 'image' ? [] : [{ url: finalUrl, kind: kind === 'audio' ? 'video' : kind, source: `direct ${contentType}` }] });
      return;
    }
    const html = await readText(response);
    res.json({ pageUrl: finalUrl, status: response.statusCode, title: extractTitle(html), candidates: sniffHtml(html, finalUrl) });
  } catch (error) {
    const info = describeNetworkError(error);
    res.status(200).json({ error: info.reason, message: info.message, candidates: [] });
  }
}

function escapeAttr(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function shellPage(title, body, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeAttr(title)}</title>
<style>body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#0c0e13;color:#c9cdd6;display:grid;place-items:center;height:100vh;text-align:center;padding:24px;box-sizing:border-box}h1{font-size:18px;color:#fff;margin:0 0 8px}code{color:#ff6b6f;word-break:break-all}</style>
</head><body><div>${body}</div><script>parent.postMessage(Object.assign({__uvp:true},${JSON.stringify(message)}),'*');</script></body></html>`;
}

const PAGE_CSP = "sandbox allow-scripts allow-forms allow-presentation allow-pointer-lock";

export async function handlePage(req, res) {
  const url = String(req.query.url ?? '');
  const custom = decodeToken(String(req.query.tok ?? '_'));
  res.setHeader('Content-Security-Policy', PAGE_CSP);
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const headers = buildUpstreamHeaders(custom);
    headers.accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
    const { response, finalUrl } = await fetchUpstream(url, { headers });
    const status = response.statusCode ?? 0;
    const contentType = String(response.headers['content-type'] ?? '');
    const kind = classifyContentType(contentType, finalUrl);
    if (kind !== 'html' && kind !== 'unknown') {
      response.destroy();
      res.type('html').send(
        shellPage('Media detected', `<h1>This link is media, not a webpage</h1><p><code>${escapeAttr(contentType)}</code></p>`, {
          type: 'non-html',
          url: finalUrl,
          kind,
          contentType,
        }),
      );
      return;
    }
    let html = await readText(response);
    html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');
    const injection = `<base href="${escapeAttr(finalUrl)}"><script>${snifferScript}</script>`;
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (tag) => `${tag}${injection}`);
    else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html[^>]*>/i, (tag) => `${tag}<head>${injection}</head>`);
    else html = `${injection}${html}`;
    html += `<script>parent.postMessage({__uvp:true,type:'loaded',status:${status},pageUrl:${JSON.stringify(finalUrl)},title:document.title},'*');</script>`;
    res.status(200).type('html').send(html);
  } catch (error) {
    const info = describeNetworkError(error);
    res
      .status(200)
      .type('html')
      .send(shellPage('Page failed to load', `<h1>Could not load page</h1><p>${escapeAttr(info.message)}</p><p><code>${escapeAttr(url)}</code></p>`, { type: 'page-error', reason: info.reason, message: info.message }));
  }
}

const OEMBED_PROVIDERS = [
  { test: /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/, endpoint: 'https://www.youtube.com/oembed?format=json&url=' },
  { test: /(^|\.)vimeo\.com$/, endpoint: 'https://vimeo.com/api/oembed.json?url=' },
  { test: /(^|\.)(dailymotion\.com|dai\.ly)$/, endpoint: 'https://www.dailymotion.com/services/oembed?format=json&url=' },
  { test: /(^|\.)streamable\.com$/, endpoint: 'https://api.streamable.com/oembed.json?url=' },
];

/** Title + thumbnail for platform links (used for history entries). */
export async function handleOEmbed(req, res) {
  cors(res);
  const url = String(req.query.url ?? '');
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    res.status(400).json({ error: 'bad-url' });
    return;
  }
  const provider = OEMBED_PROVIDERS.find((entry) => entry.test.test(host));
  if (!provider) {
    res.status(404).json({ error: 'no-provider' });
    return;
  }
  try {
    const headers = buildUpstreamHeaders({});
    headers.accept = 'application/json';
    const { response } = await fetchUpstream(provider.endpoint + encodeURIComponent(url), { headers });
    if ((response.statusCode ?? 500) >= 400) {
      response.resume();
      res.status(404).json({ error: 'not-found' });
      return;
    }
    const data = JSON.parse(await readText(response, 512 * 1024));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({ title: data.title, author: data.author_name, thumbnail: data.thumbnail_url });
  } catch (error) {
    const info = describeNetworkError(error);
    res.status(502).json({ error: info.reason, message: info.message });
  }
}
